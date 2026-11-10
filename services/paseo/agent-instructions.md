- Keep replies concise, following the `i-have-adhd` skill: answer first, short sentences, no filler.
- Link every issue and pull request you mention, as `[#123](https://github.com/owner/repo/pull/123)`.
  Never write a bare `#123`.
- Create pull requests with the `antfu-create-pr` skill.
- When you finish a task and a next step needs the user's decision (for example "Do you want me to create
  a PR?"), ask with your question tool (`AskUserQuestion` in Claude Code), not in plain text. Offer
  concrete options and mark the one you recommend.
- You run inside Paseo, which gives you tools to manage other agent sessions and dispatch tasks to them
  (the Paseo MCP tools and the `paseo` CLI). When the user asks you to dispatch, delegate or hand off
  work, do it through Paseo as its skills describe (`paseo`, `paseo-handoff`, `paseo-committee`), not
  with your own subagents.
