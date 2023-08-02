import "dotenv/config";
import { LinearClient, Project, Cycle, Issue } from "@linear/sdk";
import OpenAI from "openai";

const linearClient = new LinearClient({
  apiKey: process.env.LINEAR_API_KEY,
});
const openAi = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const TEAM_NAME = process.env.TEAM_NAME;
const TEAM_URL = process.env.TEAM_URL;
const TEAM_ID = process.env.TEAM_ID;
const EXCLUDE_PROJECT_NAMES =
  process.env.EXCLUDE_PROJECT_NAMES?.split(",") || [];

async function ai(prompt: string) {
  try {
    const gptResponse = await openAi.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 100,
      temperature: 0.9,
      n: 1,
    });
    return gptResponse.choices[0].message.content;
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

async function getCycles() {
  const { nodes } = await linearClient.cycles({
    filter: {
      team: {
        id: { eq: TEAM_ID },
      },
    },
  });
  const currentCycle = nodes.find((n) => n.progress !== 0);
  if (!currentCycle) {
    throw new Error("No current cycle found");
  }

  const lastCycle = nodes[nodes.findIndex((n) => n.id == currentCycle.id) + 1];

  return {
    currentCycle,
    lastCycle,
  };
}

async function getTeam() {
  const { nodes } = await linearClient.teams({
    filter: {
      id: { eq: TEAM_ID },
    },
  });

  if (!nodes[0]) {
    throw new Error("No team found");
  }

  return nodes[0];
}

async function getProjects() {
  const team = await getTeam();

  const { nodes } = await team.projects({
    filter: {
      state: { eq: "planned" },
      name: { nin: EXCLUDE_PROJECT_NAMES },
    },
  });

  return nodes;
}

async function getIssues(project: Project, cycle: Cycle) {
  const { nodes } = await linearClient.issues({
    filter: {
      cycle: {
        id: { eq: cycle.id },
      },
      project: {
        id: { eq: project.id },
      },
    },
  });

  return nodes;
}

const getSmartTitle = (issue: Issue) =>
  ai(`
  Give me a title for this Linear ticket that is about the same size (one line is preferred) but
  it's more readable and understandable for a human. Please reply only with the generated title, no boilerplate, no chat, no "Title:".

  Title: ${issue.title}
  Description: ${issue.description}
`).then((title) => title?.replace("\n", ""));

async function getIssueTitleAndLink(issue: Issue) {
  const title = (await getSmartTitle(issue)) || issue.title;
  return `${title} ([${issue.identifier}](${issue.url}))`;
}

async function printLastCycleProjects(projects: Project[], lastCycle: Cycle) {
  console.log("## 📊 **Progress**");

  for (const project of projects) {
    const issues = await getIssues(project, lastCycle);

    if (issues.length < 1) {
      continue;
    }

    const printableIssues = await Promise.all(
      issues.map((issue) => getIssueTitleAndLink(issue)),
    );

    console.log(`
### ${project.name}

**Status:** 💙 On Track

**Links:** [Linear](${project.url})

${printableIssues.map((issue) => `- ${issue}`).join("\n")}
`);

    console.log(`\n`);
  }
}

async function printCurrentCycleProjects(
  projects: Project[],
  currentCycle: Cycle,
) {
  console.log("## 📅 Next Week");
  for (const project of projects) {
    const issues = await getIssues(project, currentCycle);

    if (issues.length < 1) {
      continue;
    }

    const printableIssues = await Promise.all(
      issues.map((issue) => getIssueTitleAndLink(issue)),
    );

    console.log(`
- ${project.name}
${printableIssues.map((issue) => `\t- ${issue}`).join("\n")}
`);
  }
}

const getDateOfLastWeeksMonday = () => {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day == 0 ? -6 : 1) - 7;
  return new Date(today.setDate(diff));
};

async function getLastWeekBugs() {
  const { nodes } = await linearClient.issues({
    filter: {
      team: { id: { eq: TEAM_ID } },
      triagedAt: { null: false },
      createdAt: { gt: getDateOfLastWeeksMonday() },
    },
  });

  return nodes;
}

async function printOpenBugsSinceLastCycle() {
  const issues = await getLastWeekBugs();
  const printableIssues = await Promise.all(
    issues.map((issue) => getIssueTitleAndLink(issue)),
  );

  console.log(`
## 🐛 Ops, Bugs & Incidents

${printableIssues.map((issue) => `- ${issue}`).join("\n")}
`);
}

async function main() {
  const { currentCycle, lastCycle } = await getCycles();
  const projects = await getProjects();

  console.log(`
[${TEAM_NAME}](${TEAM_URL})
`);

  await printLastCycleProjects(projects, lastCycle);
  await printOpenBugsSinceLastCycle();

  console.log(`
## ⚠️  Problems

- *Any challenges and issues*

## 💙 Team Pulse

- *Any challenges and issues*
`);

  await printCurrentCycleProjects(projects, currentCycle);
}

main();
