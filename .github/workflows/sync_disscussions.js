// Import necessary libraries
const { graphql } = require("@octokit/graphql");
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const fs = require('fs').promises;
const path = require('path');

dayjs.extend(utc);

// Utility function to write data to a file synchronously
async function writeToFileSync(filePath, data) {
  try {
    const directory = path.dirname(filePath);
    // Ensure the directory exists or create recursively
    await fs.mkdir(directory, { recursive: true });
    // Write data to the file
    await fs.writeFile(filePath, data);
  } catch (error) {
    // Log and rethrow any errors
    console.error('Error writing file:', error);
    throw error;
  }
}

// Function to fetch discussions from GitHub using GraphQL
async function fetchDiscussions(token, owner, repo, limit = 10) {
  let hasMore = true;
  let afterCursor = null;
  const allDiscussions = [];

  const query = `
    query get_discussions($owner: String!, $repo: String!, $after: String, $limit: Int = 10) {
      repository(owner: $owner, name: $repo) {
        discussions(first: $limit, after: $after) {
          pageInfo {
            endCursor
            startCursor
            hasNextPage
          }
          nodes {
            // GraphQL query structure to fetch discussions
            // (Nested structure to retrieve necessary information)
          }
        }
      }
    }`;

  // Create a GraphQL client with authorization headers
  const graphqlWithAuth = graphql.defaults({
    headers: {
      authorization: `token ${token}`,
    },
  });

  // Fetch discussions in a loop until there are no more pages
  while (hasMore) {
    try {
      const response = await graphqlWithAuth(query, { owner, repo, after: afterCursor, limit });
      const discussions = response.repository.discussions.nodes;
      // Log fetched discussions
      console.log(`Fetched ${discussions.length} discussions.`);
      allDiscussions.push(...discussions);

      const pageInfo = response.repository.discussions.pageInfo;
      hasMore = pageInfo.hasNextPage;
      afterCursor = pageInfo.endCursor;
    } catch (error) {
      // Log and rethrow any errors during discussions fetching
      console.error('Error fetching discussions:', error.message);
      throw error;
    }
  }

  return allDiscussions;
}

// Main function to orchestrate the entire process
async function main() {
  // Extract username and repository name from the environment variable
  const repo = process.env.GITHUB_REPOSITORY;
  const [username, repoName] = repo.split("/");

  console.log("Username:", username);
  console.log("Repository Name:", repoName);

  console.log('Fetching discussions...');
  // Fetch discussions using GitHub token, username, and repository name
  let allDiscussions = await fetchDiscussions(process.env.GITHUB_TOKEN, username, repoName);
  console.log('Fetched', allDiscussions.length, 'discussions.');

  // Use a map to store unique discussions based on their number and ID
  const discussionMap = new Map();

  // Filter and keep the most updated discussions from the fetched ones
  for (const v of allDiscussions) {
    if (v.authorAssociation !== "OWNER") {
      continue;
    }

    const key = `${v.number}_${v.id}`;
    const existing = discussionMap.get(key);

    if (existing && dayjs(existing.updatedAt).isAfter(dayjs(v.updatedAt))) {
      continue;
    }

    discussionMap.set(key, v);
  }

  // Convert the map values to an array for further processing
  const finalDiscussions = Array.from(discussionMap.values());

  // Define the order of categories for sorting discussions
  const categoryOrder = ['announcements', 'show-and-tell'];

  // Sort discussions based on category and last updated time
  finalDiscussions.sort((a, b) => {
    const indexA = categoryOrder.indexOf(a.category.slug);
    const indexB = categoryOrder.indexOf(b.category.slug);

    if (indexA !== indexB) {
      return indexA - indexB;
    }

    return dayjs(b.updatedAt).diff(dayjs(a.updatedAt));
  });

  // Log the final discussions in JSON format
  console.log(JSON.stringify(finalDiscussions));

  // Array to store promises for writing files
  const writePromises = [];
  const READMEData = [];
  const SUMMARYData = new Map();

  // Process each final discussion for writing files and generating metadata
  for (const v of finalDiscussions) {
    const jsonFilePath = `discussions/${v.number}_${v.id}.json`;
    // Write discussion data to a JSON file
    writePromises.push(writeToFileSync(jsonFilePath, JSON.stringify(v, null, 2)));

    const metadata = {
      author: v.author?.login || '',
      category: `${v.category?.emojiHTML ? v.category.emojiHTML.match(/>(.*?)</)?.[1] + ' ' : ''}${v.category?.name || ''}`,
      labels: (v.labels?.nodes || []).map(label => label.name).join(', '),
      discussion: v.url || '',
      updatedAt: dayjs(v.updatedAt).utcOffset(8).format('YYYY-MM-DD HH:mm:ss') || '',
    };

    const frontMatter = Object.entries(metadata)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    const markdownTitle = `# ${v.title || 'Unknown Title'}`;
    const markdownBody = v.body.trim() || 'No content';

    const createdAtInCST = dayjs(v.createdAt).utcOffset(8);
    const year = createdAtInCST.year();
    const month = createdAtInCST.month() + 1;
    const mdFilePath = `markdowns/${year}/${month}/${v.number}_${v.id}.md`;

    // Write metadata and discussion content to a markdown file
    writePromises.push(writeToFileSync(mdFilePath, `---\n${frontMatter}\n---\n\n${markdownTitle}\n\n${markdownBody}\n`));

    const labels = v.labels?.nodes.map(label => `[${label.name}](https://github.com/onntztzf/test_action/discussions?discussions_q=label%3A${label.name})`);
    READMEData.push([`[${metadata.category}](https://github.com/onntztzf/test_action/discussions/categories/${v.category?.slug}?discussions_q=)`, `[${v.title}](${year}/${month}/${v.number}_${v.id}.md)`, labels.join(", "), metadata.updatedAt]);

    const key = `${year}/${month}`;
    SUMMARYData.set(key, [...(SUMMARYData.get(key) || []), `[${v.title}](${year}/${month}/${v.number}_${v.id}.md)`]);
  }

  // Construct README file content
  let README = "# README\n\n";
  README += "Just a repository for blogs. :)\n\n";
  README += "## Table of Contents\n\n";
  README += "| Category | Article | Labels | Last Updated |\n";
  README += "| --- | --- | --- | --- |\n";

  // Populate README table data
  READMEData.forEach(v => {
    README += `| ${v[0]} | ${v[1]} | ${v[2]} | ${v[3]} |\n`;
  });

  README += "\n如果觉得文章不错，可以关注公众号哟！\n\n";
  README += "![干货输出机](https://file.zhangpeng.site/wechat/qrcode.jpg)\n";

  // Write README file
  writePromises.push(writeToFileSync("README.md", README));

  // Construct SUMMARY file content
  let SUMMARY = "# SUMMARY\n\n";
  let lastKey = '';

  // Populate SUMMARY file content
  SUMMARYData.forEach((value, key) => {
    if (lastKey !== key) {
      SUMMARY += `- [${key}](${key})\n`;
    }

    value.forEach(element => {
      SUMMARY += `  - ${element}\n`;
    });

    lastKey = key;
  });

  SUMMARY.trim();
  SUMMARY += "\n";

  // Write SUMMARY file
  writePromises.push(writeToFileSync("SUMMARY.md", SUMMARY));

  // Wait for all write operations to complete
  await Promise.all(writePromises);

  // Log completion message along with the total number of discussions
  console.log("Done. Total discussions:", finalDiscussions.length);
}

// Run the main function
main();
