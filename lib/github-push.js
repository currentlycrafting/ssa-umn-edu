const fs = require("fs");

function parseGithubRepoConfig() {
  const githubToken = process.env.GITHUB_TOKEN || "";
  const repoUrl = process.env.GITHUB_REPO || "";
  const branch = process.env.GITHUB_BRANCH || "main";
  const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (!githubToken || !match) return null;
  const [, owner, repo] = match;
  return { githubToken, owner, repo, branch };
}

async function pushFileToGithub(config, repoPath, absoluteFilePath, message) {
  const headers = {
    Accept: "application/vnd.github.v3+json",
    Authorization: `Bearer ${config.githubToken}`,
    "Content-Type": "application/json"
  };
  const getUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${repoPath}?ref=${encodeURIComponent(config.branch)}`;
  const putUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${repoPath}`;
  const getRes = await fetch(getUrl, { headers });
  const getData = await getRes.json().catch(() => ({}));
  const sha = getData && getData.sha ? getData.sha : null;
  const raw = fs.readFileSync(absoluteFilePath);
  const body = {
    message,
    content: Buffer.from(raw).toString("base64"),
    branch: config.branch
  };
  if (sha) body.sha = sha;
  const putRes = await fetch(putUrl, { method: "PUT", headers, body: JSON.stringify(body) });
  if (!putRes.ok) {
    const errData = await putRes.json().catch(() => ({}));
    throw new Error(errData.message || `GitHub push failed for ${repoPath}`);
  }
}

async function pushBufferToGithub(config, repoPath, buffer, message) {
  const headers = {
    Accept: "application/vnd.github.v3+json",
    Authorization: `Bearer ${config.githubToken}`,
    "Content-Type": "application/json"
  };
  const getUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${repoPath}?ref=${encodeURIComponent(config.branch)}`;
  const putUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${repoPath}`;
  const getRes = await fetch(getUrl, { headers });
  const getData = await getRes.json().catch(() => ({}));
  const sha = getData && getData.sha ? getData.sha : null;
  const body = {
    message,
    content: Buffer.from(buffer).toString("base64"),
    branch: config.branch
  };
  if (sha) body.sha = sha;
  const putRes = await fetch(putUrl, { method: "PUT", headers, body: JSON.stringify(body) });
  if (!putRes.ok) {
    const errData = await putRes.json().catch(() => ({}));
    throw new Error(errData.message || `GitHub push failed for ${repoPath}`);
  }
}

module.exports = { parseGithubRepoConfig, pushFileToGithub, pushBufferToGithub };
