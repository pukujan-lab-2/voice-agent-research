# Brand, marketing and UX

This is the permanent guide to how we present the product: what we promise, what it's called, how we write about it, and how its pages behave. Decisions in [docs/decisions/](decisions/README.md) win over this guide. When one changes, update this page in the same pull request.

## Positioning

- **Who it's for:** people who'd rather not ask for help again. Someone whose one form sends them from search results to manuals to papers and back.
- **The promise:** you can ask out loud, in your own words, as many times as you need.
- **What it is:** an AI helper on a website. We say so ([0020](decisions/0020-honest-that-it-is-an-ai.md)).
- **What it never is:** a neighbour, someone next door, or anything that watches a street ([0019](decisions/0019-market-positioning-not-a-neighbour.md)). It shows up when someone asks and never pushes itself on them.

## Name and brand

- **Name:** not chosen yet. It isn't a human first name, isn't "Copilot" (another company's product), and has no neighbour meaning. Shortlist:
  - **Ask Again:** tells people they can keep asking without shame. This is the fear in our main story.
  - **Halfway:** it meets people halfway.
  - **Handrail:** something steady you reach for when you choose to.
- **The AI label:** "AI" sits next to the name everywhere, such as "Ask Again, an AI you can talk to out loud".
- **Logo:** a simple mark, like a sound wave or a speech mark. No face.
- **Look:** it comes with the name. Avoid the generic AI-page look: Bricolage or Inter Tight type, small uppercase labels above headings, yellow on navy, full-bleed photos under a dark gradient, and everything fading in on scroll.

## Marketing copy

How we write:

- Start from people and feelings, not features. Storyboard the people before building any page or demo.
- Write each story from inside the person, then cut the page lines from it. The before chains into the next step: Frank's son has shown him before, so he doesn't want to ask again.
- Write only what the pictures or the people's real stories show. No invented clock times, counts or results.
- Plain words. No em dashes, no AI jargon, no "not X but Y" lines.
- A phrase used in a brief to set the tone is direction, not copy. It never goes on the page as written.
- Numbers become simple charts, and each one names its source.
- Testimonials come only from real people, through `/api/testimonials`. With none yet, the page shows an honest empty wall, never a made-up quote.
- Composite people are labelled as composite on the page.

The current home page lines:

- **Headline:** Nobody should have to figure it out alone.
- **Subhead:** When one form sends you from search results to manuals to papers and back, there's someone to ask. Out loud, in your own words, as many times as you need.
- **Frank:** He's been shown how. He doesn't want to ask again.
- **Ana:** He's sick and only wants you. The appointment can't wait.
- **Sam:** The meeting is soon. It's broken. Nobody's answering.
- **The turn:** So you just ask.
- **Promises:** It listens, and answers in plain words. It shows where each answer came from. When you need a person, it brings one in. It runs on our own servers, so what you say stays yours.
- **Belief:** Technology should meet people where they are: tired, busy, and in their own words.

## UX principles

On our pages:

- Text never sits on a face.
- Each person appears once, and keeps one face across every shot.
- Contrast works in light and dark themes, and the layout works at phone width.
- Motion respects reduced-motion settings.
- A 60-second story gives a hiring manager or busy visitor the whole idea.

In the product:

- It waits to be asked.
- It answers in plain words and shows where each answer came from.
- It brings in a person when one is needed.
- It speaks as an AI.
- What people say stays on our own servers.

## Design history

Every version of the home page, the storyboards, the copy and the feedback that changed each one are kept outside this repository as a UX portfolio.
