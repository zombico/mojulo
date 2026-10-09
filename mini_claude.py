"""
mini_claude.py - a simple Claude Code-style chat that runs on your Console API credit.

Run it from inside the project folder you want Claude to work on:
    python mini_claude.py

Type your request at the "you>" prompt. Type "exit" to quit.
"""

import asyncio
import os
import sys

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    ResultMessage,
    TextBlock,
    ToolUseBlock,
)

if not os.environ.get("ANTHROPIC_API_KEY"):
    sys.exit("ANTHROPIC_API_KEY is not set. See the setup steps for how to set it.")

options = ClaudeAgentOptions(
    cwd=os.getcwd(),                                            # work in the folder you ran this from
    tools={"type": "preset", "preset": "claude_code"},          # same tools as Claude Code: read, edit, bash, search...
    system_prompt={"type": "preset", "preset": "claude_code"},  # same instructions Claude Code uses
    setting_sources=["project"],                                # reads your project's CLAUDE.md if there is one
    permission_mode="acceptEdits",                              # edits files without asking each time
    model="claude-sonnet-5-5",                                  # change to "claude-opus-5-5" for harder tasks (costs more)
)


async def main():
    total_cost = 0.0
    print(f"Working in: {os.getcwd()}\nType 'exit' to quit.\n")

    async with ClaudeSDKClient(options=options) as client:
        while True:
            try:
                prompt = input("you> ").strip()
            except (EOFError, KeyboardInterrupt):
                break
            if prompt.lower() in ("exit", "quit"):
                break
            if not prompt:
                continue

            await client.query(prompt)
            async for msg in client.receive_response():
                if isinstance(msg, AssistantMessage):
                    for block in msg.content:
                        if isinstance(block, TextBlock):
                            print(f"\nclaude> {block.text}")
                        elif isinstance(block, ToolUseBlock):
                            print(f"  [using {block.name}]")
                elif isinstance(msg, ResultMessage):
                    if msg.total_cost_usd is not None:
                        total_cost = msg.total_cost_usd
                    if msg.is_error:
                        print(f"\n[error: {msg.result or msg.terminal_reason}]")
            print(f"\n(spent so far: ${total_cost:.2f})\n")


asyncio.run(main())
