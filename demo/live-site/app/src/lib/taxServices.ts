/** The five services, their copy, and the "from" prices used across the site. */
export interface TaxService {
  slug: string;
  name: string;
  short: string;
  lede: string;
  who: string[];
  includes: string[];
  bring: string[];
  timeline: string[];
  from: string;
  fromNote: string;
  faq: { q: string; a: string }[];
}

export const TAX_SERVICES: TaxService[] = [
  {
    slug: "individual-returns",
    name: "Individual tax returns",
    short: "Federal and state returns, prepared and reviewed.",
    lede:
      "One careful return, or several years of them. We prepare federal and state returns for employees, freelancers, retirees, students and families, and we read every one twice before it is filed.",
    who: [
      "Employees with a straightforward W-2, and employees with a share plan, a side business or rental income.",
      "Self-employed people and single-member LLCs filing a Schedule C.",
      "Retirees with Social Security, pensions, annuities and required minimum distributions.",
      "Families claiming dependents, education credits, childcare or the earned income credit.",
      "People who have fallen behind and need two or three years caught up at once.",
    ],
    includes: [
      "A fifteen-minute call before we start, at no charge.",
      "Preparation of the federal return and one state return.",
      "A second-preparer review of every return before filing.",
      "Electronic filing with confirmation that the IRS accepted it.",
      "A plain-English summary of what changed and what to do next year.",
      "Your prior-year return kept on file, so next year is quicker.",
    ],
    bring: [
      "Photo ID and Social Security numbers for you, your spouse and any dependents.",
      "Forms W-2, 1099-NEC, 1099-MISC, 1099-INT, 1099-DIV, 1099-R and SSA-1099.",
      "Last year's return, if you have it.",
      "Records of deductible expenses: mortgage interest, property tax, charitable gifts, medical costs.",
      "For a business: a profit and loss summary, mileage log and receipts for large purchases.",
      "Any letter or notice you've had from the IRS.",
    ],
    timeline: [
      "Documents in by 15 March: return ready within two weeks.",
      "Documents in by 1 April: return ready before the filing deadline.",
      "Catch-up years: usually three to four weeks per year, because transcripts take time to arrive.",
      "Extensions: we file Form 4868 for you at no extra charge if we need more time.",
    ],
    from: "from $295",
    fromNote: "Federal and one state; the quote is fixed before we start.",
    faq: [
      {
        q: "Do I have to come to your office?",
        a: "No. Most clients send documents through a secure folder and talk to their preparer by phone or video. The Harrow Falls office is open if you'd rather sit down together.",
      },
      {
        q: "What if my return is complicated?",
        a: "We quote after the first call, once we know what is involved. Multi-state returns, share plans, rental property and business schedules all have their own line in the quote.",
      },
      {
        q: "Can you file an extension for me?",
        a: "Yes, and there is no charge for it. An extension moves the filing date, not the payment date, so we'll also work out whether you should send money with it.",
      },
    ],
  },
  {
    slug: "bookkeeping",
    name: "Small-business bookkeeping",
    short: "Monthly books you can actually read.",
    lede:
      "Clean, current books, closed every month, with a short note that tells you what the numbers mean. Built for owner-run businesses with one to twenty people.",
    who: [
      "Owner-run shops, studios, trades and consultancies.",
      "Single-member LLCs and partnerships that need books their accountant can use.",
      "Businesses whose receipts live in a shoebox and whose books are two years behind.",
      "Owners who want to know their real profit before they spend it.",
    ],
    includes: [
      "Monthly categorising of income and expenses from your bank and card feeds.",
      "Bank and credit card reconciliation every month.",
      "A monthly close with a one-page summary and three things to watch.",
      "Quarterly estimated tax figures, so there are no April surprises.",
      "Year-end pack handed to whoever prepares the return, including us.",
      "A call whenever a number looks wrong.",
    ],
    bring: [
      "Access to your business bank and card accounts, read-only is fine.",
      "Your accounting software login, or we'll set one up for you.",
      "A list of the people you pay regularly and what for.",
      "Any loan statements, leases or equipment purchases from the year.",
      "The last set of books, however untidy.",
    ],
    timeline: [
      "Catch-up work: a fixed quote after we've seen three months of statements.",
      "Ongoing: books closed by the tenth working day of the following month.",
      "Year-end pack: within three weeks of your year end.",
    ],
    from: "from $180 a month",
    fromNote: "Tiered by transaction volume; see Pricing.",
    faq: [
      {
        q: "Which software do you work in?",
        a: "Most often QuickBooks Online or Xero, but we'll work in whatever you already have rather than make you migrate.",
      },
      {
        q: "Do you do the business tax return too?",
        a: "Yes, as a separate fixed fee. Many clients have us do both, which keeps one team responsible for the whole picture.",
      },
      {
        q: "What if I only have a few transactions a month?",
        a: "Then you pay the lowest tier. We'd rather you had clean books than a subscription you resent.",
      },
    ],
  },
  {
    slug: "payroll",
    name: "Payroll",
    short: "Pay runs, deposits and W-2s, on schedule.",
    lede:
      "Payroll for small teams, run by people who will notice if a new hire's withholding looks wrong. We handle the deposits and the quarterly and annual filings.",
    who: [
      "Businesses with one to twenty-five employees.",
      "Owners paying themselves a reasonable salary from an S corporation.",
      "Households employing a nanny or a carer.",
      "Anyone who has just hired their first employee and wants it done properly.",
    ],
    includes: [
      "Direct-deposit pay runs on the schedule you choose.",
      "Federal, state and local withholding, deposited on time.",
      "Forms 941 quarterly and Form 940 annually.",
      "Forms W-2 and W-3 at year end, furnished to employees.",
      "New-hire setup, including Form W-4 and state registrations.",
      "A named person to call when a pay run needs changing.",
    ],
    bring: [
      "Your employer identification number (EIN) and state withholding account number.",
      "Completed Forms W-4 and I-9 for each employee.",
      "Each employee's rate, pay schedule and bank details.",
      "Any benefit deductions: health cover, retirement, garnishments.",
      "Your last payroll report, if someone else has been running it.",
    ],
    timeline: [
      "Setup: five working days from receiving the employee file.",
      "Pay runs: submitted two working days before payday.",
      "Quarterly filings: by the last day of the month after the quarter.",
      "W-2s: issued by 31 January.",
    ],
    from: "from $6 per employee, per month",
    fromNote: "Plus a $45 monthly base; see Pricing.",
    faq: [
      {
        q: "Can you take over mid-year?",
        a: "Yes. We reconcile year-to-date figures with the previous provider's reports before the first run, so the W-2s come out right in January.",
      },
      {
        q: "Do you handle state payroll taxes?",
        a: "We register and file in the states where your employees work. If you hire in a new state we'll tell you what it needs before the first payday.",
      },
      {
        q: "What happens if a pay run is wrong?",
        a: "We correct it in the next run and file any adjustment needed. If the mistake was ours, we cover any penalty or interest.",
      },
    ],
  },
  {
    slug: "irs-notices",
    name: "IRS notice help",
    short: "Read the letter, work out what it wants, reply.",
    lede:
      "A letter from the IRS is usually a question, not an accusation. We read it, work out what it is asking for, and reply on your behalf with the paperwork it needs.",
    who: [
      "Anyone who has had a notice and doesn't know whether to pay, reply or ignore it.",
      "People whose return was adjusted and who now show a balance they don't recognise.",
      "Taxpayers facing a penalty they think is unfair.",
      "People who have received the same letter twice.",
    ],
    includes: [
      "A read-through of the notice and a plain-English explanation of it.",
      "A check of your return and IRS transcript against what the notice claims.",
      "A written reply with the supporting documents, filed under a power of attorney.",
      "A penalty abatement request where there is a reasonable case for one.",
      "An installment agreement request if the balance is real and you need time.",
      "A call with you before anything is sent.",
    ],
    bring: [
      "The whole letter, including every page and the envelope if you still have it.",
      "The return the notice refers to.",
      "Any documents the notice mentions: 1099s, W-2s, receipts, prior correspondence.",
      "A note of anything you have already sent the IRS, and when.",
    ],
    timeline: [
      "First read and explanation: within two working days.",
      "Reply prepared: usually five to ten working days, depending on the documents needed.",
      "IRS response: commonly four to twelve weeks; we chase if it goes quiet.",
    ],
    from: "$250 flat",
    fromNote: "Per notice. Penalty abatement and payment plans quoted separately.",
    faq: [
      {
        q: "Should I pay the amount on the notice first?",
        a: "Usually not until we've checked it. Paying an amount you don't owe starts a refund claim, which is slower than disputing it. If interest is running, we'll tell you whether paying now is the cheaper route.",
      },
      {
        q: "Do I need to talk to the IRS myself?",
        a: "No. With a signed Form 2848 we deal with the notice and any calls. You'll see everything before it goes out.",
      },
      {
        q: "What if the notice is a scam?",
        a: "The IRS writes by post and does not demand payment by gift card, wire or phone. Send us a photo of the letter and we'll tell you whether it is genuine before you do anything.",
      },
    ],
  },
  {
    slug: "planning",
    name: "Tax planning",
    short: "Decisions made before the year ends.",
    lede:
      "Tax planning is the work that happens before December, when there is still time to choose. We look at the year ahead, price the options, and write down what to do.",
    who: [
      "Business owners whose profit varies and whose estimates are guesswork.",
      "People selling a property, a business or a large share holding.",
      "Households with two incomes, share awards or a new baby.",
      "Retirees working out when to take Social Security and required distributions.",
      "Anyone who has had an unexpected April bill two years running.",
    ],
    includes: [
      "A review of the current year to date: income, withholding and estimated payments.",
      "A projection for this year and next, with the assumptions written down.",
      "Two or three specific options, priced, with the trade-offs named.",
      "A withholding or estimated-payment schedule for the rest of the year.",
      "A one-page plan you can act on, not a fifty-page report.",
      "A follow-up call in the new year to check it worked.",
    ],
    bring: [
      "Your last two returns.",
      "Year-to-date profit and loss, or your latest pay slips.",
      "Any planned changes: a sale, a purchase, a retirement, a move, a new employee.",
      "Your current estimated payment schedule, if you have one.",
    ],
    timeline: [
      "Session: ninety minutes, usually in September or October.",
      "Written plan: within one week of the session.",
      "Follow-up call: in January, once the year's figures are nearly final.",
    ],
    from: "$200 an hour",
    fromNote: "Most first plans take two to three hours. Quoted in advance.",
    faq: [
      {
        q: "Is planning worth it for a small business?",
        a: "Often, yes, because the timing of a purchase, a distribution or a hire can matter more than the amount. We'll tell you honestly if there is nothing to gain this year.",
      },
      {
        q: "Can you just tell me what to pay each quarter?",
        a: "Yes. Many clients start with a single planning session and then keep us on for quarterly estimates.",
      },
      {
        q: "Do you work with my financial adviser?",
        a: "Happily, with your written permission. Plans are better when the investment and tax sides are looking at the same year.",
      },
    ],
  },
];

export function findService(slug: string | undefined): TaxService | undefined {
  return TAX_SERVICES.find((s) => s.slug === slug);
}
