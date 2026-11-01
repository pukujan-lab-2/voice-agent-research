# Issues and pull requests from Pukujan-lab/voice-agent-research

GitHub flagged the Pukujan-lab org on 2026-11-01 and would not transfer its repositories, so this one was copied to pukujan-lab-2 with its full git history. Its issues and pull requests could not move with it; every one is kept here as a file named by its old number, so `#123` in an old commit is `00123.md`. Open issues were also recreated as new issues that name their old number (Pukujan-lab/server-management#96).

| # | Type | State | Title |
| --- | --- | --- | --- |
| [136](00136.md) | PR | open | Check the huge-site layer with simulated callers and code-only checks; write down its limits (#112) |
| [135](00135.md) | PR | open | Read records through business-declared, read-only lookups (#111) |
| [134](00134.md) | PR | open | Let the model refine a search before it answers: a capped search_site tool (#110) |
| [133](00133.md) | PR | open | Search a site by section, page type and language, and measure it at 200,000 passages (#109) |
| [132](00132.md) | PR | open | Load any business's site and documents into its own Octo prefix (#108) |
| [131](00131.md) | PR | open | Find a large site's forms by search and load only the one needed |
| [130](00130.md) | PR | open | Keep each business's copilot config in Octo and load it on demand |
| [129](00129.md) | PR | closed | Load any business's site and documents into its own Octo prefix (#108) |
| [128](00128.md) | PR | open | Keep call, rate-limit and resume state in stores with a time limit and a size cap |
| [127](00127.md) | PR | open | Add task records for the huge-sites knowledge and data layer (#107) |
| [126](00126.md) | PR | open | A merge to main goes live when CI passes |
| [125](00125.md) | PR | open | Make the tax copilot ask what vague questions mean and stop dropping right answers |
| [124](00124.md) | Issue | open | Merges to main should go live by themselves when CI passes |
| [123](00123.md) | Issue | open | Warn on the standing issue when the post-deploy replay is worse than the previous production commit |
| [122](00122.md) | Issue | open | Group "I don't know" questions by topic into a documents gap list per business |
| [121](00121.md) | Issue | open | Rank mined cases by implicit user signals |
| [120](00120.md) | Issue | open | Score every live turn with code checks and chart the rate per rule |
| [119](00119.md) | Issue | open | Simulated callers on the live path, with spoken-style openers mined from real calls |
| [118](00118.md) | PR | open | File one issue per failure pattern from flagged turns |
| [117](00117.md) | Issue | closed | Flagged turns: the desk model offers something nobody told it it can do |
| [116](00116.md) | Issue | closed | Flagged turns: the desk model offers something nobody told it it can do |
| [115](00115.md) | Issue | open | Flagged turns: the desk model offers something nobody told it it can do |
| [114](00114.md) | PR | open | Replay the cases against the live site after each deploy |
| [113](00113.md) | PR | closed | Add task records for the huge-sites knowledge and data layer (#107) |
| [112](00112.md) | Issue | open | Evals for the huge-site layer: facts, vague questions and record lookups, code checks only |
| [111](00111.md) | Issue | open | Read records through business-declared, read-only lookups with risk scores |
| [110](00110.md) | Issue | open | Let the model refine a search: a capped, fixed-size search_site tool |
| [109](00109.md) | Issue | open | Search that holds up at size: filters by section, page type and language, and a measured retrieval test |
| [108](00108.md) | Issue | open | Ingest a business's own site and documents into its own Octo prefix |
| [107](00107.md) | Issue | open | Make the copilot work on huge sites: search for prose, declared lookups for records |
| [106](00106.md) | Issue | closed | Answer from the top search hit when the judge returns nothing but the hit says the question's own words |
| [105](00105.md) | PR | open | Show the model a fixed-size window of a big form instead of every field |
| [104](00104.md) | Issue | open | Find the right form on a large site by search instead of loading every flow |
| [103](00103.md) | Issue | open | Store each business's copilot config in Octo and load it on demand |
| [102](00102.md) | Issue | open | Move the backend's call, rate-limit and cache state into bounded stores, and keep resume snapshots in Octo |
| [101](00101.md) | Issue | open | Keep the model's prompt a fixed size however many fields the form has |
| [100](00100.md) | Issue | open | Make the copilot's state bounded: a form of any size, a site of any size |
| [99](00099.md) | Issue | open | Fix the tax demo copilot's conversation quality (vague questions, filler, judge threshold, quoting, next step) |
| [98](00098.md) | PR | open | Block pull requests that bring back a fixed answer, and replay every case nightly |
| [97](00097.md) | Issue | open | Standing issue: results of the live replay |
| [96](00096.md) | PR | merged | Turn flagged turns into replay cases the shipped answer path can be run against |
| [95](00095.md) | PR | merged | Flag suspect turns in real calls with plain code rules |
| [94](00094.md) | PR | merged | Add task records for the real-calls improvement loop |
| [93](00093.md) | Issue | open | Propose one issue per failure pattern from flagged turns |
| [92](00092.md) | Issue | open | Replay the cases against the live site after each deploy |
| [91](00091.md) | Issue | open | Gate pull requests on the replay cases; run the live set nightly |
| [90](00090.md) | Issue | closed | Turn flagged turns into replay cases, seeded from the 2026-11-01 call |
| [89](00089.md) | Issue | closed | Mine flagged turns from real calls with plain rules |
| [88](00088.md) | Issue | open | Make real calls improve the copilot: flag, replay, gate, re-check, propose |
| [87](00087.md) | PR | merged | The voice matrix skips a language whose reference speech won't load |
| [86](00086.md) | Issue | closed | The voice matrix dies when one language's reference speech won't load |
| [85](00085.md) | PR | merged | Deploy the lab to the VPS when the production branch moves |
| [84](00084.md) | Issue | closed | Deploy the copilot lab from a production branch that deploys by itself |
| [83](00083.md) | PR | merged | One test suite scores every voice stack, with its audio in Phoenix |
| [82](00082.md) | Issue | closed | One automated test suite for every voice config, with audio in Phoenix |
| [81](00081.md) | PR | merged | Record the LFM3-Audio task as completed |
| [80](00080.md) | PR | merged | Swap voice models in and out so only the stack in use is loaded |
| [79](00079.md) | PR | merged | PROJECT.md follows decision 0011's risk bands and loads models by config |
| [78](00078.md) | Issue | closed | PROJECT.md: align confirmation rules with decision 0011, and load models by config |
| [77](00077.md) | PR | merged | Add the LFM3-Audio voice stack and a tool-calling test for voice stacks |
| [76](00076.md) | PR | merged | PROJECT.md: a lab of swappable modules, voice first class, no more clicking around |
| [75](00075.md) | Issue | closed | PROJECT.md: state the lab aim, modules with versions, voice first class |
| [74](00074.md) | Issue | open | Swappable decision models per task: Jev, LFM3, GLiNER2.5 |
| [73](00073.md) | Issue | open | Swappable multimodal models per task: LFM3-Omni and VL (later) |
| [72](00072.md) | PR | merged | Record the task to run LFM3-Audio as a voice stack |
| [71](00071.md) | Issue | closed | LFM3-Audio end to end as a voice stack, with a tool-calling test |
| [70](00070.md) | PR | merged | Let the offline scene suite finish and say what it skipped |
| [69](00069.md) | Issue | closed | Offline scene suite stops at the voice scene, so a full run prints no summary |
| [68](00068.md) | PR | merged | Make the copilot call panel easier to read |
| [67](00067.md) | PR | merged | Give the demo pages a warmer shared design |
| [66](00066.md) | PR | merged | Task records for the parallel demo-site and widget redesigns |
| [65](00065.md) | Issue | closed | Copilot call widget looks bad and its view of the agent's page actions is too small to follow |
| [64](00064.md) | Issue | closed | Demo home page and company sites look plain; redesign them to a polished product standard |
| [63](00063.md) | PR | merged | Mark the call-recording task completed now that it has merged |
| [62](00062.md) | PR | merged | Every live call is recorded in full in Phoenix, as one session |
| [61](00061.md) | PR | merged | Voice calls run on swappable stacks, and the caller picks their language |
| [60](00060.md) | PR | merged | Each field is confirmed by its risk score, as decision 0011 sets out |
| [59](00059.md) | PR | merged | Task records for the parallel voice-stack and call-logging work |
| [58](00058.md) | PR | merged | The live site's pages talk through the v2 desk, with LFM3 writing the replies |
| [57](00057.md) | Issue | open | Resume dropped calls and remember returning customers on the live site |
| [56](00056.md) | Issue | closed | Confirm each field by its risk score on the live site |
| [55](00055.md) | Issue | open | Voice call only works in English, though visitors must be able to talk in their own language |
| [54](00054.md) | PR | merged | chore(stack): upgrade agent stack to 1.0.6 |
| [53](00053.md) | PR | merged | Decision 0011: the model leads, a 1 to 100 risk score sets how it confirms |
| [52](00052.md) | Issue | closed | Record the confirmation policy: the model leads, a 1 to 100 risk score sets how it confirms |
| [51](00051.md) | PR | merged | CI runs on GitHub-hosted runners now the repo is public |
| [50](00050.md) | Issue | closed | CI can't start since the repo went public: move to GitHub-hosted runners |
| [49](00049.md) | PR | merged | Questions about the assistant get a real answer, not a guide search |
| [48](00048.md) | Issue | closed | Questions about the assistant ("can I ask you about taxes?") get guide passages |
| [47](00047.md) | PR | merged | Demo home page links the Brindlewick tax site |
| [46](00046.md) | PR | merged | Voice call rings while connecting and stops waiting on a missing agent |
| [45](00045.md) | PR | merged | chore(stack): upgrade agent stack to 1.0.5 |
| [44](00044.md) | Issue | closed | Demo home page: link the Brindlewick tax site |
| [43](00043.md) | Issue | closed | Voice call: ring while connecting, and stop waiting on a missing agent |
| [42](00042.md) | Issue | closed | Make the repo public so main can require CI before auto-merge |
| [41](00041.md) | Issue | open | Make LFM3's replies sound as natural as the Qwen-Flash baseline, in code |
| [40](00040.md) | PR | merged | Decision 0009: LFM3 writes replies, replacing Qwen-Flash (Closes #39) |
| [39](00039.md) | Issue | closed | Replace Qwen-Flash with LFM3 for the copilot's replies |
| [38](00038.md) | PR | merged | Voice call on LiveKit Agents with our own speech models (Closes #11) |
| [37](00037.md) | PR | merged | Desk v2: LLM-led receptionist with read-backs, call resume and returning-customer memory |
| [36](00036.md) | PR | merged | Records: CI runs on the VPS runner pool, the Pro stopgap is retired |
| [35](00035.md) | PR | merged | IRS report: search latency re-measured after Octo's search fix |
| [34](00034.md) | PR | merged | chore(stack): upgrade agent stack to 1.0.4 |
| [33](00033.md) | PR | merged | chore(stack): upgrade agent stack to 1.0.3 |
| [32](00032.md) | PR | merged | fix(oio): name the repository's current owner so the stack upgrade is accepted |
| [31](00031.md) | Issue | closed | The stack upgrade to 1.0.3 is refused, because the issue-log project file still names the repository's old owner |
| [30](00030.md) | PR | merged | Run CI on the VPS runners, because the Pro runner can no longer set up Python (Refs #29) |
| [29](00029.md) | Issue | open | CI here runs on a broken MacBook Pro runner, because this private repository is outside the Pukujan-lab organization that owns the VPS runners |
| [28](00028.md) | PR | merged | chore(stack): upgrade agent stack to 1.0.2 |
| [27](00027.md) | Issue | open | Claude Code sessions here commit, push and stop without the rules' checks, checkpoints or worktree layout, because nothing enforces them |
| [26](00026.md) | PR | merged | Record CI on the Pro as a stopgap until the VPS |
| [25](00025.md) | Issue | closed | Move CI from the MacBook Pro stopgap runner to the VPS |
| [24](00024.md) | PR | merged | Run CI on the MacBook Pro runner |
| [23](00023.md) | PR | merged | chore(agents): load AGENTS.md in Claude Code |
| [22](00022.md) | PR | merged | Repo checks, CI and the ACS hotloader (one-checkout stack 1.0.1) |
| [21](00021.md) | Issue | open | Move the checkout to PCM's project-folder layout so continuity validates |
| [20](00020.md) | Issue | closed | Move CI to the MacBook Pro runner and turn on branch protection |
| [19](00019.md) | Issue | open | Offline scene test times out after submit on the tax page |
| [18](00018.md) | Issue | open | Finish loading the IRS library into Octo |
| [17](00017.md) | Issue | open | Call logger and a staff insights page |
| [16](00016.md) | Issue | closed | Merge the v2 desk (memory, resume) into the live site |
| [15](00015.md) | Issue | open | Raise held-out FAQ accuracy and simulated-caller success |
| [14](00014.md) | Issue | open | Hand off personal-advice questions instead of quoting the guides |
| [13](00013.md) | Issue | open | Keep context across follow-up questions |
| [12](00012.md) | Issue | open | Ask a clarifying question when a question is vague |
| [11](00011.md) | Issue | closed | Rebuild voice on LiveKit Agents with our own speech models |
| [10](00010.md) | Issue | closed | Decision 0008. Repository checks, CI and ACS |
| [9](00009.md) | Issue | closed | Decision 0007. Not hosted yet |
| [8](00008.md) | Issue | closed | Decision 0006. Which model does what |
| [7](00007.md) | Issue | closed | Decision 0005. Evals are fully automated |
| [6](00006.md) | Issue | closed | Decision 0004. Octo is the one store |
| [5](00005.md) | Issue | closed | Decision 0003. The model makes one small decision; code acts |
| [4](00004.md) | Issue | closed | Decision 0002. Voice runs on LiveKit Agents |
| [3](00003.md) | Issue | closed | Decision 0001. Open models only in the product |
| [2](00002.md) | PR | merged | Live demo: send each call to Phoenix through Octo |
| [1](00001.md) | PR | open | Add copilot concept demo and its skill |
