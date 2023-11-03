const {graphql} = require("@octokit/graphql");
const fs = require('fs').promises;
const path = require('path');

// Configuration settings, including GitHub access token, repository owner, and repository name
const config = {
    github_token: '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', // Replace with your GitHub access token
    owner: 'onntztzf', // Replace with the owner of the repository
    repo: 'blog', // Replace with the name of the repository
};

// Asynchronous function to write data to a file
async function writeToFileSync(filePath, data) {
    try {
        const directory = path.dirname(filePath);
        await fs.mkdir(directory, {recursive: true});
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
            const response = await graphqlWithAuth(query, {owner, repo, after: afterCursor, limit});
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

    console.log(process.env)

    const repo = process.env.GITHUB_REPOSITORY;

    // 使用 split 方法将字符串拆分为数组
    const parts = repo.split("/");
    
    // parts[0] 包含用户名，parts[1] 包含仓库名称
    const username = parts[0];
    const repoName = parts[1];
    
    console.log("Username:", username);
    console.log("Repository Name:", repoName);

    console.log('Fetching discussions...');
    let allDiscussions = await fetchDiscussions(process.env.GITHUB_TOKEN,username, repoName);
    console.log('Fetched', allDiscussions.length, 'discussions.');

    // Filter discussions where the author association is the OWNER
    allDiscussions = allDiscussions.filter(discussion => discussion.authorAssociation === "OWNER");

    const writePromises = allDiscussions.map(async (discussion) => {
        try {
            const jsonFilePath = `discussions/${discussion.number}_${discussion.id}.json`;
            await writeToFileSync(jsonFilePath, JSON.stringify(discussion, null, 2));

            const updatedAtInUTC = new Date(discussion.updatedAt);
            const updatedAt = updatedAtInUTC.toLocaleString("zh-Hans", { timeZone: "Asia/Shanghai" });

            const metadata = {
                author: discussion.author?.login || '',
                category: (discussion.category?.emojiHTML ? discussion.category.emojiHTML.match(/>(.*?)</)?.[1] + ' ' : '') + (discussion.category?.name || ''),
                labels: (discussion.labels?.nodes || []).map(label => label.name).join(', '),
                discussion: discussion.url || '',
                updated_at: updatedAt || '',
            };

            const frontMatter = Object.entries(metadata)
                .map(([key, value]) => `${key}: ${value}`)
                .join('\n');

            const markdownTitle = `# ${discussion.title || 'Unknown Title'}`;
            const markdownBody = discussion.body.trim() || 'No content';

            const createdAtInUTC = new Date(discussion.createdAt);
            const createdAtInCST = new Date(createdAtInUTC.toLocaleString("zh-Hans", { timeZone: "Asia/Shanghai" }));
            // 获取年份
            const year = createdAtInCST.getFullYear();
            // 获取月份（注意：月份从0开始，所以需要加1）
            const month = createdAtInCST.getMonth() + 1;

            const mdFilePath = `markdowns/${year}/${month}/${discussion.number}_${discussion.id}.md`;
            await writeToFileSync(mdFilePath, `---\n${frontMatter}\n---\n\n${markdownTitle}\n\n${markdownBody}\n`);
        } catch (error) {
            console.error('Error processing discussion:', error);
            throw error;
        }
    });
    await Promise.all(writePromises);

    console.log("Done. Total discussions:", allDiscussions.length);
}

// Execute the main function to start the process
main();
