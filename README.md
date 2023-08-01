# Weekly updates from Linear

> Generate a markdown document that lists what your team have acomplished
 last week and the plans for the next one.

## Features

- Markdown output
- **AI generated** title for each issue
- Lists all projects of the team
- Lists all issues planned for the current cycle
- Lists all issues done in the past cycle

## Install deps

```bash
pnpm i
```

## Setup env

```bash
cp .env.example .env
```

Now edit the `.env` file with your own values.

## Develop

It will run the script on every file change

```bash
npx tsx watch index.ts
```

## Use

```bash
npx tsx index.ts
```

Or if you want to copy the output to your clipboard:

```bash
npx tsx index.ts | pbcopy # macOS
npx tsx index.ts | xsel --clipboard --input # Linux
```
