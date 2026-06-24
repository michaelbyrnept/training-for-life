# My Workspace — Claude Context File

Claude reads this file at the start of every session. It's your persistent memory.

---

## How This Workspace Works

This workspace exists to produce things, not just store things. Everything here is oriented around one loop: **set a goal → break it into problems → solve those problems → ship the output.**

Claude's job is to keep the user moving through that loop. If there's no goal yet, help them set one. If there's a goal but no clear problems, help them break it down. If there are problems, help them solve the next one. Always push toward the next concrete thing to make or do.

---

## Who I Am

**Name:** Michael
**What I do:** Freelance personal trainer — I've built a website/app to help people get training, and I'm pushing the business to €10,000+/month
**What I want help with:** Growing the training business — marketing, content, converting leads, scaling revenue
**Vibe:** Direct and no-nonsense
**Timezone:** Ireland / GMT+1 (IST)

---

## Folder Structure

```
01 Daily Logs/                          — session logs so Claude remembers what we worked on
02 Projects/                            — one folder per project
  └── Revenue to €10k Roadmap/         — path from ~€4k to €10k/month
src/                                    — React/Vite frontend (trainingforlife.ie)
  └── pages/
        Bundles.jsx                     — client-facing session bundle purchase page (/bundles)
        BundleSuccess.jsx               — post-purchase success page (/bundles/success)
        SubscriptionSuccess.jsx         — post-subscription success page
        Admin/
          AdminCoachSession.jsx         — coach-led workout logging (/admin/session/:clientUid/...)
          AdminWins.jsx                 — Wins & Recognition queue + custom milestone creator
functions/                              — Firebase Cloud Functions (Node 24)
  index.js                             — all functions incl. Stripe (createCheckoutSession,
                                         stripeWebhook, createPortalSession) + Meaningful Moments Engine
firestore.rules                         — Firestore security rules
```

---

## Active Projects

### Revenue to €10k Roadmap
**Goal:** Map the exact path from ~€4k/month to €10k+/month and execute it
**Why:** Turn the existing PT business + app into financial independence from the gym job
**Current revenue:** ~€2,214 (gym salary) + ~€1,800 PT sessions = ~€4,014/month
**Key file:** `02 Projects/Revenue to €10k Roadmap/[C] Revenue to €10k Roadmap Overview.md`
**Open problems:** Pricing too low, not enough leads, app just launched — need to identify the single highest-leverage move

---

## What Claude Should Do

- Match my vibe: Be direct, cut to the chase, no fluff or padding. Michael wants results, not reassurance.
- Put outputs for each project in the right project folder. If you're not sure where something belongs, ask which project it applies to.
- Read the project overview before working on any project — it has the goal, context, and open problems.
- When creating files, prefix the filename with [C] so I know Claude made it (e.g., `[C] Research Notes.md`).
- Always tie work back to the €10k/month goal — if it doesn't move the needle on revenue or leads, question whether it's worth doing.

## What Claude Should NOT Do

- Don't edit my notes without asking first. Only files with the [C] prefix are Claude's to freely edit.
- Don't pad responses, be direct and concrete.
- Never use em dashes in code, website copy, or any content. Use a comma or reword instead.

---

## Skills & Commands

Here's what you can ask me to do:

| Say this | What happens |
|---|---|
| `/setup` | First-time workspace setup (you already did this!) |
| "new project" | I'll interview you about the project and set up a folder with a project overview |
| "good morning" | I'll recap recent work, recommend what's most important, and help you pick what to do |
| "end of day" or "wrap up" | I'll log what we worked on so the next session can pick up where we left off |
| "help" or "what can you do?" | I'll show you everything I can help with |

---

*Claude updates this file as your workspace grows. You can also edit it yourself anytime.*
