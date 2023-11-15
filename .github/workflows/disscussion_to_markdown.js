const { graphql } = require("@octokit/graphql");
const dayjs = require('dayjs')
const utc = require('dayjs/plugin/utc');
dayjs.extend(utc);

const fs = require('fs').promises;
const path = require('path');

// Asynchronous function to write data to a file
async function writeToFileSync(filePath, data) {
  try {
    const directory = path.dirname(filePath);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(filePath, data);
    console.log('File written successfully:', filePath);
  } catch (error) {
    console.error('Error writing file:', error);
    throw error; // Stop handling errors
  }
}

// Asynchronous function to fetch discussions from a GitHub repository
async function fetchDiscussions(token, owner, repo, limit = 10) {
  let hasMore = true;
  let afterCursor = null;
  const all_discussions = [];

  const query = `
    query get_discussions($owner: String!, $repo: String!, $after: String, $limit: Int = 10) {
        repository(owner:$owner, name: $repo) {
            discussions(first: $limit, after:$after) {
              pageInfo {
                  endCursor
                  startCursor
                  hasNextPage
                }
              nodes {
                id
                labels(first: 10) {
                  nodes {
                    id
                    name
                    resourcePath
                    url
                  }
                }
                category {
                  id
                  name
                  emoji
                  emojiHTML
                  slug
                }
                number
                title
                body
                author {
                  login
                }
                authorAssociation
                createdAt
                updatedAt
                repository {
                  id
                  url
                  resourcePath
                }
                url
                resourcePath
              }
            }
          }
    }`;

  // Create a GraphQL client with authentication using the provided access token
  const graphqlWithAuth = graphql.defaults({
    headers: {
      authorization: `token ${token}`,
    },
  });

  while (hasMore) {
    try {
      const response = await graphqlWithAuth(query, { owner, repo, after: afterCursor, limit });
      const discussions = response.repository.discussions.nodes;
      all_discussions.push(...discussions);

      const pageInfo = response.repository.discussions.pageInfo;
      hasMore = pageInfo.hasNextPage;
      afterCursor = pageInfo.endCursor;
    } catch (error) {
      console.error('Error fetching discussions:', error.message);
      throw error;
    }
  }

  return all_discussions;
}

// Main asynchronous function to orchestrate the process
async function main() {

  // console.log(process.env)

  const repo = process.env.GITHUB_REPOSITORY;

  // 使用 split 方法将字符串拆分为数组
  const parts = repo.split("/");

  // parts[0] 包含用户名，parts[1] 包含仓库名称
  const username = parts[0];
  const repoName = parts[1];

  console.log("Username:", username);
  console.log("Repository Name:", repoName);

  console.log('Fetching discussions...');
  let allDiscussions = await fetchDiscussions(process.env.GITHUB_TOKEN, username, repoName);
  console.log('Fetched', allDiscussions.length, 'discussions.');

  const discussionMap = new Map();
  for (let i = 0; i < allDiscussions.length; i++) {
    const v = allDiscussions[i];
    if (v.authorAssociation !== "OWNER") {
      continue
    }
    const key = `${v.number}_${v.id}`;
    const existing = discussionMap.get(key);
    if (existing && dayjs(existing.updatedAt).isAfter(dayjs(v.updatedAt))) {
      continue
    }
    discussionMap.set(key, v);
  }

  const finalDiscussions = Array.from(discussionMap.values());
  const categoryOrder = ['announcements', 'show-and-tell'];

  function orderDiscussion(a, b) {
    const indexA = categoryOrder.indexOf(a.category.slug);
    const indexB = categoryOrder.indexOf(b.category.slug);
    if (indexA !== indexB) {
      return indexA - indexB;
    }
    return dayjs(b.updatedAt).diff(dayjs(a.updatedAt));
  }

  finalDiscussions.sort(orderDiscussion);

  console.log(JSON.stringify(finalDiscussions))

  const writePromises = []
  const READMEData = []
  const SUMMARYData = new Map()
  for (let i = 0; i < finalDiscussions.length; i++) {
    const v = finalDiscussions[i];

    const jsonFilePath = `discussions/${v.number}_${v.id}.json`;
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
    const createdAtInCST = dayjs(v.createdAt).utcOffset(8)
    // 获取年份
    const year = createdAtInCST.year();
    // 获取月份（注意：月份从 0 开始，所以需要加 1）
    const month = createdAtInCST.month() + 1;
    const mdFilePath = `markdowns/${year}/${month}/${v.number}_${v.id}.md`;
    writePromises.push(writeToFileSync(mdFilePath, `---\n${frontMatter}\n---\n\n${markdownTitle}\n\n${markdownBody}\n`));
    // https://github.com/onntztzf/test_action/discussions?discussions_q=
    //label
    // https://github.com/onntztzf/test_action/discussions?discussions_q=label%3Adocumentation
    //category
    // https://github.com/onntztzf/test_action/discussions/categories/announcements?discussions_q=
    const labels = []
    for (let i = 0; i < v.labels?.nodes.length; i++) {
      const label = v.labels?.nodes[i];
      labels.push(`[${label.name}](https://github.com/onntztzf/test_action/discussions?discussions_q=label%3A${label.name})`)
    }
    READMEData.push([`[${metadata.category}](https://github.com/onntztzf/test_action/discussions/categories/${v.category?.slug}?discussions_q=)`, `[${v.title}](${year}/${month}/${v.number}_${v.id}.md)`, labels.join(", "), metadata.updatedAt])
    const key = `${year}/${month}`;
    let existing = SUMMARYData.get(key);
    if (existing) {
      existing.push(`[${v.title}](${year}/${month}/${v.number}_${v.id}.md)`)
    } else {
      existing = []
    }
    SUMMARYData.set(key, existing);
  }

  console.log(SUMMARYData)

  let README = "# README\n\n";
  README += "Just a repository for blogs. :)\n\n";
  README += "## Table of Contents\n\n";
  README += "| Category | Article | Labels | Last Updated |\n";
  README += "| --- | --- | --- | --- |\n";
  for (let i = 0; i < READMEData.length; i++) {
    const v = READMEData[i];
    README += `| ${v[0]} | ${v[1]} | ${v[2]} | ${v[3]} |\n`;
  }
  README += "\n如果觉得文章不错，可以关注公众号哟！\n\n"
  README += "![干货输出机](https://file.zhangpeng.site/wechat/qrcode.jpg)\n"
  writePromises.push(writeToFileSync("README.md", README));

  let SUMMARY = "# SUMMARY\n\n";
  let lastKey = ''
  SUMMARYData.forEach(function (value, key, map) {
    if (lastKey !== key) {
      SUMMARY += `- [${key}]${key}\n`
    }
    for (let i = 0; i < value.length; i++) {
      const element = value[i];
      SUMMARY += `  - ${element}\n`
    }
    lastKey = key
  })
  SUMMARY.trim()
  SUMMARY += "\n"
  writePromises.push(writeToFileSync("SUMMARY.md", SUMMARY));

  await Promise.all(writePromises);



  // const contents = [];
  // const writePromises = allDiscussions.map(async (discussion) => {
  //   try {
  //     const jsonFilePath = `discussions/${discussion.number}_${discussion.id}.json`;
  //     await writeToFileSync(jsonFilePath, JSON.stringify(discussion, null, 2));

  // const updatedAtInUTC = new Date(discussion.updatedAt);
  // const updatedAt = updatedAtInUTC.toLocaleString("zh-Hans", { timeZone: "Asia/Shanghai" });

  // const metadata = {
  //   author: discussion.author?.login || '',
  //   category: (discussion.category?.emojiHTML ? discussion.category.emojiHTML.match(/>(.*?)</)?.[1] + ' ' : '') + (discussion.category?.name || ''),
  //   labels: (discussion.labels?.nodes || []).map(label => label.name).join(', '),
  //   discussion: discussion.url || '',
  //   updated_at: updatedAt || '',
  // };

  //     const frontMatter = Object.entries(metadata)
  //       .map(([key, value]) => `${key}: ${value}`)
  //       .join('\n');

  //     const markdownTitle = `# ${discussion.title || 'Unknown Title'}`;
  //     const markdownBody = discussion.body.trim() || 'No content';

  //     const createdAtInUTC = new Date(discussion.createdAt);
  //     const createdAtInCST = new Date(createdAtInUTC.toLocaleString("zh-Hans", { timeZone: "Asia/Shanghai" }));
  //     // 获取年份
  //     const year = createdAtInCST.getFullYear();
  //     // 获取月份（注意：月份从 0 开始，所以需要加 1）
  //     const month = createdAtInCST.getMonth() + 1;

  //     const mdFilePath = `markdowns/${year}/${month}/${discussion.number}_${discussion.id}.md`;
  //     contents.push([`${year}/${month}`, `[${discussion.title}](${year}/${month}/${discussion.number}_${discussion.id}.md)`, updatedAt])
  //     await writeToFileSync(mdFilePath, `---\n${frontMatter}\n---\n\n${markdownTitle}\n\n${markdownBody}\n`);
  //   } catch (error) {
  //     console.error('Error processing discussion:', error);
  //     throw error;
  //   }
  // });
  // await Promise.all(writePromises);

  console.log("Done. Total discussions:", finalDiscussions.length);
}

// Execute the main function to start the process
main();
