"""Brindlewick's public-site content: the pages, services, industries, blog, reviews, jobs, tax calendar, document
checklist and calculator rates of a FICTIONAL tax and accounting firm, written into the Octo workspace's Postgres.
Octo is the only store; there is no local copy. The backend that reads these tables is practice-api.ts (/api/site/*).

  bw_pages                   one row per public page (site search)
  bw_services                10 services: body sections, FAQs, forms, citations
  bw_industries              6 industries
  bw_articles                9 blog articles
  bw_reviews                 36 sample reviews (labelled "sample" on the site)
  bw_jobs                    3 openings
  bw_deadlines               federal deadlines Jan 2026 - Dec 2027 (weekend/holiday rule applied)
  bw_checklist_situations    and bw_checklist_items: the document checklist
  bw_rates                   figures the calculators use, each from a library passage

Every citation points at a passage of the IRS library in the same database (irs_passages / irs_docs). Before anything is
written, the script re-reads every cited passage from Octo and stops if a quote is not an exact substring of that
passage, if a quote is outside 8-40 words, or if a [n] marker has no matching citation.

Re-running replaces every row of these tables (truncate, then insert). Usage:
  uv run python tools/bw_content.py
"""
import datetime as dt, json, pathlib, re, sys, urllib.error, urllib.request

HERE = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE.parent.parent / "copilot-engine" / "tools"))
import paddle_passages as pp  # noqa: E402  (reads the Octo key/workspace from ~/Documents/projects/.env, never printed)

BASE = "https://octodb.design-bakery.com/api"


def octo(path, body):
    e = pp.env()
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), method="POST",
                                 headers={"Authorization": "Bearer " + e["octo_db_chatbots"], "Content-Type": "application/json", "User-Agent": "chatbots-rag/0.1"})
    try:
        return json.load(urllib.request.urlopen(req, timeout=300))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Octo {e.code}: {e.read()[:400]!r} for {body.get('sql', '')[:160]!r}") from None


def sql(text, params=None):
    r = octo(f"/workspaces/{pp.env()['octo_db_chatbots_workspace']}/query", {"sql": text, **({"params": params} if params else {})})
    if isinstance(r, dict) and r.get("error"):
        raise RuntimeError(f"{r['error']}: {r.get('message', '')} :: {text[:120]}")
    return r


def rows_of(r):
    return r.get("rows", []) if isinstance(r, dict) else r


def insert(table, rows, chunk=500):
    if not rows:
        return
    cols = ", ".join(rows[0].keys())
    for i in range(0, len(rows), chunk):
        sql(f"insert into {table} ({cols}) select {cols} from json_populate_recordset(null::{table}, $1::json)", [json.dumps(rows[i:i + chunk], default=str)])


# ---------------------------------------------------------------------------------------------------------------------
# Citations. Each entry is (irs_passages.id, exact quote). doc, title, section and url are filled from Octo at run time.
# ---------------------------------------------------------------------------------------------------------------------
Q = {
    # vehicles
    "mile": ("irs/publications-p463 #5", "For 2025, the standard mileage rate for the cost of operating your car for business use is 70 cents ($0.70) per mile."),
    "mile_first": ("irs/publications-p463 #255", "If you want to use the standard mileage rate for a car you own, you must choose to use it in the first year the car is available for use in your business."),
    "mile_records": ("irs/publications-p463 #493", "For car expenses, the cost of the car and any improvements, the date you started using it for business, the mileage for each business use, and the total miles for the year."),
    "no_estimate": ("irs/publications-p463 #476", "You can’t deduct amounts that you approximate or estimate."),
    "commute": ("irs/publications-p463 #214", "Transportation expenses between your home and your main or regular place of work are personal commuting expenses."),
    "med21": ("irs/publications-p502 #158", "If you don’t want to use your actual expenses for 2025, you can use the standard medical mileage rate of 21 cents a mile."),
    "char14": ("irs/publications-p526 #401", "If you use the standard mileage rate of 14 cents a mile, your records must show the miles you drove your car for the charitable purpose."),
    # self-employment tax
    "se_rate": ("irs/publications-p334 #521", "The 2025 SE tax rate on net earnings is 15.3% (12.4% social security tax plus 2.9% Medicare tax)."),
    "se_base25": ("irs/instructions-i1040sse #1", "For 2025, the maximum amount of self-employment income subject to social security tax is $176,100."),
    "se_9235": ("irs/publications-p334 #543", "To figure net earnings using the regular method, multiply your self-employment earnings by 92.35% (0.9235)."),
    "se_400": ("irs/instructions-i1040sse #6", "You must pay SE tax if you had net earnings of $400 or more as a self-employed person."),
    # payroll
    "ss26": ("irs/publications-p15 #348", "For 2026, the social security tax rate is 6.2% (amount withheld) each for the employer and employee (12.4% total). The social security wage base limit is $184,500."),
    "med": ("irs/publications-p15 #348", "The tax rate for Medicare is 1.45% (amount withheld) each for the employee and employer (2.9% total). There is no wage base limit for Medicare tax"),
    "addl": ("irs/publications-p15 #349", "In addition to withholding Medicare tax at 1.45%, you must withhold a 0.9% Additional Medicare Tax from wages you pay to an employee in excess of $200,000 in a calendar year."),
    "futa": ("irs/instructions-i940 #51", "The FUTA tax is 6.0% (0.060) for 2025. Most employers receive a maximum credit of up to 5.4% (0.054) against this FUTA tax."),
    "futa7000": ("irs/instructions-i940 #20", "The FUTA tax applies to the first $7,000 you pay to each employee during a calendar year after subtracting any payments exempt from FUTA tax."),
    "941_due": ("irs/instructions-i941 #92", "Your Form 941 is due by the last day of the month that follows the end of the quarter."),
    "941_lookback": ("irs/publications-p15 #389", "If you reported $50,000 or less of taxes for the lookback period, you’re a monthly schedule depositor; if you reported more than $50,000, you’re a semiweekly schedule depositor."),
    "941_new": ("irs/publications-p15 #399", "Therefore, you’re a monthly schedule depositor for the first calendar year of your business."),
    "941_monthly": ("irs/publications-p15 #398", "Under the monthly deposit schedule, deposit employment taxes on payments made during a month by the 15th day of the following month."),
    "941_semi": ("irs/publications-p15 #401", "Under the semiweekly deposit schedule, deposit employment taxes for payments made on Wednesday, Thursday, and/or Friday by the following Wednesday."),
    "941_100k": ("irs/publications-p15 #421", "If you accumulate $100,000 or more in taxes on any day during a monthly or semiweekly deposit period"),
    "trustfund": ("irs/publications-p15 #99", "Treasury by making federal tax deposits. This is the reason that these withheld taxes are called trust fund taxes."),
    "officer": ("irs/publications-p15 #121", "If the business is incorporated, corporate officers who work in the business are employees of the corporation."),
    "doctors": ("irs/publications-p15 #121", "For example, doctors, lawyers, veterinarians, and others in an independent trade in which they offer their services to the public are usually not employees."),
    "control": ("irs/publications-p15 #120", "Generally, a worker who performs services for you is your employee if you have the right to control what will be done and how it will be done."),
    "w2": ("irs/publications-p15a #209", "A Form W-2 must be prepared even if all of the sick pay is nontaxable (see Box 12 below). All Forms W-2 must be given to the employees by January 31."),
    "w2_2026": ("irs/instructions-i1040gi #252", "Your employer is required to provide or send Form W-2 to you no later than February 2, 2026."),
    "940_due": ("irs/instructions-i940 #32", "The due date for filing Form 940 for 2025 is February 2, 2026."),
    "940_jan31": ("irs/publications-p15 #574", "If your liability for the fourth quarter (plus any undeposited amount from any earlier quarter) is over $500, deposit the entire amount by the due date of Form 940 (January 31)."),
    "p15_weekend": ("irs/publications-p15 #93", "If any date shown next for filing a return, furnishing a form, or depositing taxes falls on a Saturday, Sunday, or legal holiday, the due date is the next business day."),
    # S corporations
    "scorp_wages": ("irs/instructions-i1120s #281", "Distributions and other payments by an S corporation to a corporate officer must be treated as wages to the extent the amounts are reasonable compensation for services rendered to the corporation."),
    "scorp_2pct": ("irs/instructions-i1120s #285", "Include fringe benefit expenditures made on behalf of officers and employees owning more than 2% of the corporation’s stock. Also report these fringe benefits as wages in box 1 of Form W-2."),
    "1120s_due": ("irs/instructions-i1120s #34", "For calendar year corporations, the due date is March 16, 2026 (March 15th falls on Sunday)."),
    # information returns
    "nec2000": ("irs/instructions-i1099mec #4", "For tax years beginning after 2025, the minimum threshold amount for reporting certain payments required to be reported on certain information returns and/or perform backup withholding on those payments increased to $2,000"),
    "nec_due": ("irs/instructions-i1099mec #9", "Section 6071(c) requires you to file Form 1099-NEC on or before January 31, using either paper or electronic filing procedures."),
    "misc_due": ("irs/instructions-i1099mec #9", "File Form 1099-MISC by February 28, if you file on paper, or March 31, if you file electronically."),
    "furnish": ("irs/instructions-i1099gi #209", "Generally, you must furnish Forms 1098, 1099, 3921, 3922, and W-2G information by February 2, 2026."),
    "furnish_b": ("irs/instructions-i1099gi #209", "Forms 1099-B, 1099-DA, 1099-S, and 1099-MISC (if you are reporting payments in only box 8 or 10) must be furnished by February 17, 2026."),
    "efile_1099": ("irs/instructions-i1099gi #107", "E-file Forms 1097, most Forms 1098, and most Forms 1099, 3921, 3922, or W-2G by March 31, 2026."),
    "1099k": ("irs/instructions-i1040gi #756", "payment card companies, payment apps, and online marketplaces will be required to send you a Form 1099-K only if the amount of your business transactions during the year is more than $20,000"),
    "1099k_err": ("irs/instructions-i1040gi #751", "that shows payments that were included in error (for example, money for gifts or reimbursements) or for personal items that you sold at a loss"),
    "1099g": ("irs/instructions-i1040gi #761", "If you received a refund, credit, or offset of state or local income taxes in 2025, you may be required to report this amount."),
    # estimated tax and individual returns
    "est1000": ("irs/publications-p505 #298", "You expect to owe at least $1,000 in tax for 2026 after subtracting your withholding and tax credits."),
    "est90": ("irs/publications-p505 #298", "90% of the tax to be shown on your 2026 tax return, or\n100% of the tax shown on your 2025 tax return."),
    "est110": ("irs/publications-p505 #349", "If your AGI for 2025 was more than $150,000 ($75,000 if your filing status for 2026 is Married filing separately), substitute 110% for 100% in (2) above."),
    "estdates": ("irs/publications-p505 #365", "If the due date for an estimated tax payment falls on a Saturday, Sunday, or legal holiday, the payment will be on time if you make it on the next day"),
    "estjan": ("irs/publications-p505 #365", "If you file your 2026 Form 1040 or 1040-SR by January 31, 2027, and pay the rest of the tax you owe, you don’t need to make the payment due on January 15, 2027."),
    "std26_single": ("irs/publications-p505 #8", "For 2026, the standard deduction amount has been increased for all filers, and the amounts are as follows.\nSingle or Married filing separately—$16,100."),
    "std26_mfj": ("irs/publications-p505 #8", "Single or Married filing separately—$16,100.\nMarried filing jointly or Qualifying surviving spouse—$32,200."),
    "std26_hoh": ("irs/publications-p505 #8", "Married filing jointly or Qualifying surviving spouse—$32,200.\nHead of household—$24,150."),
    "std25_single": ("irs/publications-p501 #337", "The individual’s earned income for the year plus $450 (but not more than the regular standard deduction amount, generally $15,750)."),
    "std25_mfj": ("irs/publications-p501 #335", "Neither is blind, and neither can be claimed as a dependent. They decide not to itemize their deductions. They use Table 6 . Their standard deduction is $31,500."),
    "1040due": ("irs/publications-p17 #44", "Due date of return. File Form 1040 or 1040-SR by April 15, 2026."),
    "4868": ("irs/instructions-i1040gi #55", "You can get an automatic 6-month extension if, no later than the date your return is due, you file Form 4868."),
    "4868_pay": ("irs/instructions-i1040gi #55", "An automatic 6-month extension to file doesn’t extend the time to pay your tax."),
    "salt": ("irs/instructions-i1040sca #30", "The deduction for state and local taxes is generally limited to $40,000 ($20,000 if married filing separately)."),
    "8822": ("irs/instructions-i1040gi #86", "If you plan to move after filing your return, use Form 8822 to notify the IRS of your new address."),
    # amended returns
    "x_after": ("irs/instructions-i1040x #28", "File Form 1040-X only after you have filed your original return. You may amend your original return by filing Form 1040-X more than once"),
    "x_3yr": ("irs/instructions-i1040x #28", "Generally, for a credit or refund, you must file Form 1040-X within 3 years (including extensions) after the date you filed your original return or within 2 years after the date you paid the tax, whichever is later."),
    "x_sep": ("irs/instructions-i1040x #12", "Then, figure the tax on the corrected amount of taxable income and the amount you owe or your refund. File a separate Form 1040-X for each tax year you are amending."),
    "x_time": ("irs/instructions-i1040x #81", "You should generally allow 8 to 12 weeks for Form 1040-X to be processed. However, in some cases, processing could take up to 16 weeks."),
    "x_penalty": ("irs/instructions-i1040x #19", "If you file Form 1040-X claiming a refund or credit for more than the correct amount, you may be subject to a penalty of 20% of the disallowed amount."),
    "x_state": ("irs/instructions-i1040x #16", "File a separate Form 1040-X for each year you are amending. If you are changing your federal return, you may also need to change your state return."),
    # notices, payment plans, representation
    "cp_compare": ("irs/taxtopics-tc652 #0", "Using an automated system, the Automated Underreporter (AUR) function compares the information reported by third parties to the information reported on your return to identify potential discrepancies."),
    "cp_notbill": ("irs/taxtopics-tc652 #1", "The CP2000 isn't a bill, it's a proposal to adjust your income, payments, credits, and/or deductions."),
    "cp_30": ("irs/taxtopics-tc652 #13", "Respond within 30 days of the date of the notice or 60 days if you live outside the United States for a quick resolution."),
    "cp_disagree": ("irs/taxtopics-tc652 #9", "If you don't agree with some or all of the proposed changes, mark the appropriate box on the Response form and reply to us along with a signed statement explaining why you disagree."),
    "cp_interest": ("irs/taxtopics-tc652 #6", "Payment of the proposed amount within 30 days will stop additional interest, and possibly, additional penalties, from accruing."),
    "cp_snod": ("irs/taxtopics-tc652 #14", "If we don't hear from you by the response date on the notice, we’ll send you a Statutory Notice of Deficiency."),
    "9465_180": ("irs/instructions-i9465 #6", "If you can pay the full amount you owe within 180 days, you can avoid paying the fee to set up a payment plan by calling the IRS at 800-829-1040."),
    "9465_50k": ("irs/instructions-i9465 #7", "If your balance due is $50,000 or less in combined tax, penalties, and interest, you can apply online for a payment plan instead of filing Form 9465."),
    "9465_fee": ("irs/instructions-i9465 #7", "If you establish your payment plan using the OPA application, the user fee that you pay will be lower than it would be otherwise."),
    "9465_guar": ("irs/instructions-i9465 #31", "You’re eligible, if you are an individual with tax owed of $10,000 or less, excluding interest and penalties, and:"),
    "9465_accrue": ("irs/instructions-i9465 #18", "Make your payments as large as possible to limit interest and penalty charges. The charges will continue to accrue until you pay them in full."),
    "9465_dd": ("irs/instructions-i9465 #23", "Making your payments by direct debit will help ensure that your payments are made timely and you don’t default on this payment plan."),
    "9465_30": ("irs/instructions-i9465 #36", "We will usually let you know within 30 days after we receive your request whether it is approved or denied."),
    "2848": ("irs/taxtopics-tc311 #2", "Submit a power of attorney if you want to authorize an individual to represent you before the IRS. You can use Form 2848, Power of Attorney and Declaration of Representative for this purpose."),
    "8821": ("irs/taxtopics-tc311 #4", "If you want to allow a person to receive your tax information, but don't want this person to represent you before the IRS, you can use Form 8821, Tax Information Authorization"),
    "rep_notatty": ("irs/taxtopics-tc311 #1", "The individual you select does not need to be an attorney, as there are other categories of individuals authorized to practice before the IRS in addition to attorneys."),
    # business returns and records
    "1065_cal": ("irs/instructions-i1065 #72", "Generally, a domestic partnership must file Form 1065 by the 15th day of the 3rd month following the date its tax year ended"),
    "6072b": ("irc/6072 #2", "Returns of partnerships under section 6031 and returns of S corporations under sections 6012 and 6037 made on the basis of the calendar year shall be filed on or before the 15th day of March"),
    "1120due": ("irc/6072 #0", "returns made on the basis of the calendar year shall be filed on or before the 15th day of April following the close of the calendar year"),
    "7004": ("irs/instructions-i7004 #9", "The automatic extension period for time to file is generally 6 months. Exceptions apply for certain filers of Form 1041"),
    "7004_1041": ("irs/instructions-i7004 #9", "An estate (other than a bankruptcy estate) and a trust filing Form 1041 are eligible for an automatic 5½-month extension of time to file."),
    "schc": ("irs/instructions-i1040sc #10", "An activity qualifies as a business if your primary purpose for engaging in the activity is for income or profit and you are involved in the activity with continuity and regularity."),
    "records_books": ("irs/publications-p583 #127", "Your books must show your gross income, as well as your deductions and credits. For most small businesses, the business checkbook (discussed later) is the main source for entries in the business books."),
    "records_supp": ("irs/publications-p583 #133", "Supporting documents include sales slips, paid bills, invoices, receipts, deposit slips, and canceled checks."),
    "179": ("irs/instructions-i4562 #4", "For tax years beginning in 2025, the maximum section 179 expense deduction is $2,500,000."),
    "sep": ("irs/publications-p560 #59", "Contributions you make for 2025 to a common-law employee's SEP IRA can't exceed the lesser of 25% of the employee's compensation or $70,000."),
    # home office
    "ho_excl": ("irs/publications-p587 #6", "To qualify under the exclusive use test, you must use a specific area of your home only for your trade or business."),
    "ho_partition": ("irs/publications-p587 #6", "The area used for business can be a room or other separately identifiable space. The space does not need to be marked off by a permanent partition."),
    "ho_both": ("irs/publications-p587 #6", "You do not meet the requirements of the exclusive use test if you use the area in question both for business and for personal purposes."),
    "ho_ppb": ("irs/publications-p587 #15", "To qualify to deduct the expenses for the business use of your home under the principal place of business test, your home must be your principal place of business for that trade or business."),
    "ho_simpl": ("irs/publications-p587 #111", "In most cases, you will figure your deduction by multiplying $5, the prescribed rate, by the area of your home used for a qualified business use."),
    "ho_300": ("irs/publications-p587 #111", "The area you use to figure your deduction is limited to 300 square feet."),
    # rentals
    "rent_275": ("irs/publications-p527 #145", "You must begin depreciating the addition in 2025 using MACRS. Under GDS, the addition is depreciated as residential rental property over 27.5 years."),
    "rent_land": ("irs/publications-p527 #174", "The sales contract showed that the building cost $160,000 and the land cost $25,000. Your basis for depreciation is its original cost, $160,000."),
    "rent_25k": ("irs/publications-p527 #213", "If you or your spouse actively participated in a passive rental real estate activity, you may be able to deduct up to $25,000 of loss from the activity from your nonpassive income."),
    "rent_personal": ("irs/publications-p527 #22", "If you sometimes use your rental property for personal purposes, you must divide your expenses between rental and personal use."),
    # tips
    "tips_large": ("irs/publications-p15 #252", "A large food or beverage establishment is one that is located in the 50 states or the District of Columbia, provides food or beverages for consumption on the premises, where tipping is customary"),
    "tips_alloc": ("irs/publications-p15 #253", "The tips may be allocated by one of three methods—hours worked, gross receipts, or good-faith agreement."),
    "45b": ("irs/publications-p334 #211", "This credit is generally equal to your (employer’s) portion of social security and Medicare taxes paid on tips received by employees of your food and beverage establishment where tipping is customary."),
    "tips_20": ("irs/publications-p531 #40", "If you received $20 or more in cash and charge tips in a month from any one job and didn’t report all of those tips to your employer"),
    # digital assets
    "da_def": ("irs/instructions-i1040gi #141", "Digital assets are any digital representations of value that are recorded on a cryptographically secured distributed ledger or any similar technology."),
    "da_1099": ("irs/instructions-i1040gi #28", "If, in 2025, you used a broker to effect the sale of a digital asset, your broker should send you a Form 1099-DA that reports information regarding the transaction."),
    "da_basis": ("irs/instructions-i1040gi #28", "In 2025, your broker has the option to report your basis in the digital asset on Form 1099-DA but is not required to do so."),
    "da_question": ("irs/instructions-i1040gi #29", "you must answer the digital asset question on Form 1040 whether or not you received a Form 1099-DA"),
    # estates, trusts, nonprofits, foreign accounts
    "1041_600": ("irs/publications-p559 #302", "Every domestic estate with gross income of $600 or more during a tax year must file a Form 1041."),
    "1041_due": ("irs/publications-p559 #418", "If the calendar year is the estate's accounting period, the 2025 Form 1041 is due by April 15, 2026"),
    "706_due": ("irs/publications-p559 #521", "If Form 706 is required, the return and payment of any tax is due within 9 months after the date of the decedent’s death."),
    "form56": ("irs/publications-p559 #14", "If you are appointed to act in a fiduciary capacity for another, you must file a written notice with the IRS stating this. Form 56 is used for this purpose."),
    "990due": ("irc/6072 #9", "a return shall be filed on or before the 15th day of the 5th month following the close of the taxable year."),
    "501c3_futa": ("irs/instructions-i940 #30", "Religious, educational, scientific, charitable, and other organizations described in section 501(c)(3) and exempt from tax under section 501(a) generally aren’t subject to FUTA tax."),
    "fbar": ("irs/publications-p516 #14", "You must file FinCEN Form 114, Report of Foreign Bank and Financial Accounts (FBAR), if you had any financial interest in, or signature or other authority over a bank, securities, or other financial account in a foreign country."),
}


def cites(*keys):
    return [{"key": k} for k in keys]


def S(heading, *paragraphs, kind="text"):
    return {"heading": heading, "kind": kind, "paragraphs": list(paragraphs)}


def F(q, a):
    return {"q": q, "a": a}


# ---------------------------------------------------------------------------------------------------------------------
# Services
# ---------------------------------------------------------------------------------------------------------------------
SERVICES = [
    dict(slug="individual", name="Individual tax returns", audience="individuals", from_price="From $325", icon="user",
         short="Federal and state Form 1040 returns for individuals and families, prepared by a credentialed preparer and checked by a second reviewer.",
         forms=["1040", "1040-SR", "Schedule A", "Schedule B", "Schedule D", "8949", "Schedule E", "2441", "8863", "8889", "8962", "4868"],
         cites=cites("1040due", "4868", "4868_pay", "std26_single"),
         body=[
             S("What's included",
               "Your federal Form 1040 and one Oregon resident return, prepared from your documents and reviewed by a second preparer before you see it. The base fee of $325 covers wages, interest, dividends, retirement income, Social Security, the standard deduction or itemized deductions, education and child-care credits, and HSA reporting.",
               "Add-ons are priced in advance: Schedule C for a sole proprietorship or gig work, +$275; each rental property on Schedule E, +$150; Form 8949 with more than 50 brokerage transactions, +$95; each additional state return, +$95; Form 8962 for Marketplace coverage, +$45.",
               "Every return includes e-filing, a PDF copy for your records, and a short letter that explains what changed from last year and what to do differently for next year."),
             S("Who it's for",
               "Employees, retirees, families with children in school or child care, people with brokerage accounts, and households with a side business or one or two rental properties. If you own a pass-through business, we prepare your business return first so the K-1 figures are final before your 1040 is filed."),
             S("How it works", kind="steps", *[
                 "Book an intake call or start the online intake. We send a document checklist built from last year's return and your answers.",
                 "Upload your documents to the client portal or drop them at any of our three offices. We confirm receipt within one business day and list anything missing.",
                 "Your preparer completes the return and a second preparer reviews it. Questions come to you in one batch, not one at a time.",
                 "We meet by phone, video or in person to walk through the return, then you sign the e-file authorization in the portal.",
                 "We file and send you the IRS acceptance. If a balance is due, we schedule the payment for the due date."]),
             S("Deadlines and extensions",
               "The 2025 Form 1040 was due April 15, 2026 [1]. Documents that reach us by March 15 are filed by the deadline. After that, we file an extension for you: Form 4868 gives an automatic 6-month extension to file [2], but it doesn't extend the time to pay [3], so we estimate any balance and you pay it by April 15.",
               "For 2026 returns, filed in 2027, the standard deduction is $16,100 for single filers [4], with higher amounts for joint filers and heads of household. We compare it with your itemized deductions every year."),
             S("What to bring", kind="list", *[
                 "Last year's federal and state returns, if you are new to us.",
                 "W-2s, 1099s (INT, DIV, B, R, G, SSA-1099, NEC, K), and any K-1s.",
                 "Form 1098 for mortgage interest, property tax bills, and charitable receipts if you might itemize.",
                 "Form 1098-T and receipts for education expenses; child-care provider names, addresses and tax ID numbers.",
                 "Form 1095-A if you had Marketplace coverage.",
                 "Records of estimated payments made during the year, with dates and amounts."]),
         ],
         faqs=[F("How long does it take?", "Most returns are ready for your review within 10 business days of the date we have everything. In March and early April it can take up to 15."),
               F("Do you prepare returns for people outside Oregon?", "Yes. About a quarter of our individual clients live elsewhere. We meet by video and exchange documents through the portal. Your resident state return is included in the base fee."),
               F("What if I'm audited?", "If the IRS or the state questions a return we prepared, we answer the first letter at no charge. Representation beyond that is billed at our notice-response rates, which we quote before starting."),
               F("Can I just drop off my documents?", "Yes. Each office has a drop-off box for sealed envelopes during business hours. We scan everything into your portal the same day and return originals at your meeting."),
               F("Is the fee due up front?", "No. We bill when the return is ready for your review, and you pay before filing. Payment by card, ACH or check.")]),
    dict(slug="business", name="Business tax returns", audience="businesses", from_price="From $1,450", icon="building-2",
         short="Returns for S corporations, partnerships and C corporations, with K-1s, depreciation schedules and extensions.",
         forms=["1120-S", "1065", "1120", "Schedule K-1", "4562", "7004", "1125-E", "8825"],
         cites=cites("1120s_due", "1065_cal", "1120due", "7004"),
         body=[
             S("What's included",
               "Federal and Oregon returns for S corporations (Form 1120-S, from $1,450), partnerships and multi-member LLCs (Form 1065, from $1,650) and C corporations (Form 1120, from $1,850). The fee includes the K-1 for each owner, the depreciation schedule on Form 4562, officer compensation reporting, and extensions when needed.",
               "Fees are quoted after we see the prior-year return and your books. Clean, reconciled books keep the fee at the low end. If we have to reconcile accounts first, we quote that work separately before starting."),
             S("Who it's for",
               "Owner-operated businesses with up to about 50 employees: contractors, medical and dental practices, restaurants, real estate partnerships, consultants and family holding companies. For multi-state businesses we file in each state where you have nexus."),
             S("How it works", kind="steps", *[
                 "In January we send a year-end request list: bank and card statements through December 31, payroll reports, loan statements, fixed-asset purchases and sales, and owner contributions and distributions.",
                 "We close and review the books, or review the books your bookkeeper closed, and send adjusting entries for your approval.",
                 "We prepare the return and K-1s. A partner reviews every business return before it goes to you.",
                 "We meet to review the result and plan for the coming year, including owner salary and estimated payments.",
                 "We file and send each owner their K-1 the same day, so the owners' personal returns aren't held up."]),
             S("Deadlines",
               "For calendar-year S corporations the 2025 return was due March 16, 2026, because March 15 fell on a Sunday [1]. Calendar-year partnerships have the same March 15 date [2]. C corporation returns follow the April 15 date for calendar-year filers [3].",
               "If books aren't final, we file Form 7004. The automatic extension is generally 6 months [4], which moves the partnership and S corporation date to September 15. An extension to file isn't an extension to pay, so for C corporations we estimate any tax due with the extension."),
             S("What to bring", kind="list", *[
                 "Prior-year federal and state returns, including the depreciation schedule.",
                 "Year-end bank, credit card and loan statements.",
                 "Payroll summaries: Forms 941, 940, W-2 and W-3.",
                 "Invoices for equipment, vehicles or improvements bought during the year, and details of anything sold.",
                 "A list of owners with ownership percentages and any changes during the year."]),
         ],
         faqs=[F("Should my LLC be taxed as an S corporation?", "It depends on profit, how much salary the owner would need to take, and state costs. We run the numbers in a planning meeting before you file the election; for many single-owner businesses it starts to make sense once profit is well above a reasonable salary."),
               F("When will I get my K-1?", "For returns filed by the March deadline, K-1s go out the same day. For extended returns we aim to finish by mid-August so owners can file personal returns before October."),
               F("Do you file state returns for other states?", "Yes. Each additional state return for a business is $225, and composite or withholding returns for nonresident owners are quoted separately."),
               F("Can you work with our existing bookkeeper?", "Yes. We send your bookkeeper a year-end checklist and our proposed adjusting entries, and they post them in your system.")]),
    dict(slug="bookkeeping", name="Monthly bookkeeping", audience="businesses", from_price="From $295/mo", icon="book-open",
         short="Monthly reconciliation and financial statements in QuickBooks Online or Xero, closed by the 20th of the following month.",
         forms=["Schedule C", "1120-S", "1065", "1099-NEC", "W-9"],
         cites=cites("records_books", "records_supp", "nec2000"),
         body=[
             S("What's included",
               "Categorizing transactions, reconciling every bank, card and loan account, and sending a profit and loss statement and balance sheet each month. The $295 monthly fee covers up to two bank accounts, one credit card and about 150 transactions a month. Higher volumes are priced at $395 and $595 a month.",
               "Your books have to show your gross income and your deductions [1]. We keep them in a form your tax preparer can use without rework, because we are the tax preparer. Every receipt and invoice you upload is attached to its transaction; sales slips, paid bills, invoices, receipts and deposit slips are the supporting documents an examiner expects [2]."),
             S("Who it's for",
               "Owner-run businesses that want accurate monthly numbers without hiring in-house: contractors, restaurants, medical practices, landlords with several properties, and service firms. Catch-up work for a year or more of unreconciled books is quoted separately."),
             S("How it works", kind="steps", *[
                 "We connect read-only bank feeds to QuickBooks Online or Xero and set up a chart of accounts that matches your tax return.",
                 "Each week we categorize transactions and send a short list of items we can't identify.",
                 "By the 20th of the following month we reconcile all accounts and send the monthly statements with a one-paragraph summary.",
                 "Each quarter we review the numbers with you and update your estimated tax payment if profit has changed.",
                 "In January we prepare your 1099-NEC filings from vendor payments in the books."]),
             S("Contractor payments and 1099s",
               "We collect a Form W-9 from each new vendor you pay for services. For payments made after 2025, the reporting threshold for Form 1099-NEC rose to $2,000 [3]. We track it vendor by vendor through the year, so there is no scramble in January."),
             S("What to bring", kind="list", *[
                 "Read-only access to your business bank and card accounts.",
                 "Loan and lease agreements, and the last statement for each.",
                 "Your most recent tax return and any year-end adjustments from your prior accountant.",
                 "A list of regular vendors and contractors, with W-9s if you have them."]),
         ],
         faqs=[F("Which software do you use?", "QuickBooks Online or Xero. The subscription is in your name, so the books stay yours if you leave."),
               F("I'm a year behind. Can you catch me up?", "Yes. Catch-up work is quoted by the month, usually $150 to $300 per month of history depending on volume, and is done before monthly service starts."),
               F("Do you pay my bills?", "Not as part of bookkeeping. We can set up bill approval in your software, but payments stay under your control."),
               F("Do you handle sales tax?", "Oregon has no general sales tax. If you sell into states that do, we can file those returns for an added monthly fee.")]),
    dict(slug="payroll", name="Payroll", audience="businesses", from_price="From $79/mo + $6 per employee", icon="wallet",
         short="Payroll processing, tax deposits, quarterly Forms 941, annual 940 and year-end W-2s for small employers.",
         forms=["941", "940", "W-2", "W-3", "W-4", "1099-NEC", "I-9"],
         cites=cites("941_due", "941_new", "w2", "trustfund"),
         body=[
             S("What's included",
               "Payroll runs on your schedule (weekly, biweekly, semi-monthly or monthly), direct deposit, pay stubs in an employee portal, federal and Oregon tax deposits, quarterly Form 941 and state returns, the annual Form 940, and W-2s and W-3. The fee is $79 a month plus $6 per employee paid that month. Owner-only S corporation payroll is $79 a month flat.",
               "New-hire reporting, Forms W-4 and I-9 collection, and workers' compensation reports are included."),
             S("Who it's for",
               "Employers with 1 to 50 employees, including S corporation owners who pay themselves a salary, restaurants with tipped staff, and seasonal businesses."),
             S("How it works", kind="steps", *[
                 "We register you for federal and Oregon payroll accounts if you are a new employer, and set up EFTPS.",
                 "You submit hours or confirm salaried payroll two business days before each pay date.",
                 "We run payroll, pay employees by direct deposit, and make every tax deposit on the schedule the IRS assigns you.",
                 "Each quarter we file Form 941, due by the last day of the month after the quarter ends [1], and the state returns.",
                 "In January we file Form 940 and deliver W-2s to employees and the SSA."]),
             S("Deposit schedules and why they matter",
               "A new employer is a monthly schedule depositor for its first calendar year [2]. After that the IRS sets the schedule from your prior tax liability, and we watch for the change. Withheld income tax and the employee share of Social Security and Medicare are trust fund taxes [3]: money held for the government. Late or missed deposits bring penalties, and unpaid trust fund taxes can become a personal liability for owners. Every deposit we make shows up in your portal with its confirmation number.",
               "W-2s must be given to employees by January 31 [4]. We deliver them through the employee portal and by mail."),
             S("What to bring", kind="list", *[
                 "Your EIN letter and Oregon business registration.",
                 "Employee W-4s, I-9s, pay rates and direct-deposit details.",
                 "Prior payroll reports if you are switching providers mid-year.",
                 "Your workers' compensation policy number."]),
         ],
         faqs=[F("Can you take over mid-year?", "Yes. We need your year-to-date payroll registers and the quarterly returns already filed, so the W-2s include all wages for the year."),
               F("Do you handle tipped employees?", "Yes. We report tips on payroll, figure the employer share of Social Security and Medicare on them, and can prepare Form 8027 for larger restaurants."),
               F("What if a deposit is late?", "If a deposit we were responsible for is late, we pay the resulting penalty. If it was late because payroll was approved late, we help you request abatement."),
               F("Do you pay contractors too?", "We can pay contractors by direct deposit and track the totals for Form 1099-NEC for no extra fee.")]),
    dict(slug="irs-notices", name="IRS notices and representation", audience="individuals", from_price="From $250", icon="mail-warning",
         short="Responses to IRS and state letters, from CP2000 underreporting notices to collection, with an enrolled agent or CPA as your representative.",
         forms=["2848", "8821", "1040-X", "9465", "843", "433-F"],
         cites=cites("cp_notbill", "2848", "8821", "rep_notatty"),
         body=[
             S("What's included",
               "We read the notice, pull your IRS account and wage-and-income transcripts, compare them to your return, and send the response. Fees start at $250 for a single-issue notice such as a CP2000 or a missing-payment letter. Penalty abatement requests start at $300. Collection work, such as payment plans or responding to a final notice, is quoted after the first review.",
               "Many notices are proposals rather than final bills. A CP2000, for example, isn't a bill; it's a proposal to adjust your return [1]. A clear, documented answer often reduces or removes the amount."),
             S("Who it's for",
               "Anyone who has received a letter from the IRS or a state tax agency, whether or not we prepared the return. We also help with unfiled years and balances owed."),
             S("How it works", kind="steps", *[
                 "Send us a photo or scan of every page of the notice, including the response form.",
                 "You sign Form 2848 so we can represent you [2], or Form 8821 if you only want us to see your records without representing you [3].",
                 "We pull transcripts, identify the issue and tell you what we recommend and what it will cost.",
                 "We prepare and send the response before the deadline and keep you copied on everything.",
                 "We follow up until the IRS closes the matter and send you the closing letter."]),
             S("Who represents you",
               "Your representative is one of our enrolled agents or CPAs. Representation before the IRS doesn't require an attorney; enrolled agents and CPAs are authorized to practice too [4]. If a matter needs a tax attorney, we tell you and refer you."),
             S("What to bring", kind="list", *[
                 "Every page of the notice and its envelope.",
                 "The return the notice refers to, with the forms and statements used to prepare it.",
                 "Any earlier letters about the same issue, and anything you've already sent the IRS.",
                 "Proof of payments the IRS may not have matched, such as bank statements or EFTPS confirmations."]),
         ],
         faqs=[F("The deadline is in a few days. Can you still help?", "Usually. We can call the IRS under a power of attorney to request more time, and often get it. Send the notice today."),
               F("Do I need to call the IRS myself?", "No. Once Form 2848 is processed we deal with the IRS directly and you don't need to call."),
               F("You didn't prepare the return. Does that matter?", "No. We'll need a copy of the return and the documents behind it."),
               F("Can you get penalties removed?", "Sometimes. First-time abatement is available for many taxpayers with a clean history, and reasonable-cause relief applies when something outside your control caused the problem. We tell you which applies before filing a request.")]),
    dict(slug="planning", name="Tax planning", audience="individuals", from_price="From $400", icon="compass",
         short="Mid-year projections, estimated payments, entity choice and retirement contributions, worked out in dollars before the year ends.",
         forms=["1040-ES", "W-4", "2210", "5498"],
         cites=cites("est1000", "est110", "sep"),
         body=[
             S("What's included",
               "A projection of this year's federal and state tax from your year-to-date figures, a written summary of options with the dollar effect of each, and estimated payment amounts for the rest of the year. A single planning session is $400. Our year-round plan, at $1,200 a year, adds a spring and a late-summer review and an updated projection after any major event such as a sale or a new business."),
             S("Who it's for",
               "Self-employed people and business owners, anyone with a large one-time income event (a business sale, a stock vest, a Roth conversion, a home sale), new retirees, and households whose withholding left them with a large balance due last April."),
             S("How it works", kind="steps", *[
                 "Send year-to-date pay stubs, business profit and loss, and any expected one-time income.",
                 "We build the projection and test two or three options.",
                 "We meet for an hour to go through the results.",
                 "You get a one-page summary with the decisions, amounts and dates."]),
             S("What we look at",
               "Estimated payments: you generally need to pay during the year if you expect to owe at least $1,000 after withholding and credits [1]. We set payments to the safe-harbor amount that costs you least, keeping in mind that higher earners must pay 110% of last year's tax rather than 100% to be protected [2].",
               "Retirement contributions: for business owners, a SEP IRA allows contributions of up to 25% of an employee's compensation, capped at $70,000 for 2025 [3]. We compare it with a solo 401(k) and with an employee plan if you have staff.",
               "Timing: when to recognize income or pay deductible expenses, whether to bunch charitable gifts, and which year a sale should close."),
             S("What to bring", kind="list", *[
                 "Last year's return.",
                 "Year-to-date pay stubs or business profit and loss.",
                 "Brokerage and retirement account statements.",
                 "Details of any sale, bonus or other one-time event you expect."]),
         ],
         faqs=[F("When is the best time for planning?", "Between June and October. There is still time to change withholding, estimated payments and contributions before December 31."),
               F("Is the planning fee credited toward my return?", "For new clients, yes: the first session's fee is credited against your return fee for the same year."),
               F("Do you give investment advice?", "No. We show the tax effect of decisions you and your financial adviser are considering, but we don't recommend investments."),
               F("Can you plan for an S corporation election?", "Yes. That's one of the most common planning meetings for business owners, usually done together with our business tax team.")]),
    dict(slug="prior-year", name="Prior-year and amended returns", audience="individuals", from_price="From $275 per year", icon="history",
         short="Unfiled past-year returns and Form 1040-X amendments, prepared from IRS transcripts when your own records are incomplete.",
         forms=["1040-X", "1040", "8821", "2848", "4506-C"],
         cites=cites("x_3yr", "x_sep", "x_time", "x_state"),
         body=[
             S("What's included",
               "Amended individual returns start at $275 per year, including the matching state amendment. Unfiled prior-year returns are priced like a current-year return for that year, from $325, plus $75 for transcript retrieval. We pull your IRS wage-and-income transcripts so the return matches what the IRS already has."),
             S("Who it's for",
               "People who found an error or a missed form after filing, received a corrected W-2 or 1099, or have one or more years that were never filed. If the IRS has already sent a notice about an unfiled year, see our notice service; we handle both together."),
             S("How it works", kind="steps", *[
                 "You sign Form 8821 or 2848 so we can pull your transcripts.",
                 "We compare transcripts, your records and any return already filed, and tell you what is missing.",
                 "We prepare the returns, oldest year first, and explain what each one means for refunds or balances due.",
                 "We file electronically where the IRS allows it, and by mail otherwise.",
                 "We track processing and tell you when each return is posted."]),
             S("Refund deadlines and processing",
               "To claim a refund, an amended return generally has to be filed within 3 years of filing the original or 2 years of paying the tax, whichever is later [1]. Each year needs its own Form 1040-X [2]. Processing generally takes 8 to 12 weeks and can take up to 16 [3]. A federal change often means a state change too [4], and we file both together."),
             S("What to bring", kind="list", *[
                 "Any notices received for the years involved.",
                 "Copies of returns already filed, if you have them.",
                 "W-2s, 1099s and records for income not on the transcripts, such as cash business income.",
                 "Receipts for deductions you want to claim."]),
         ],
         faqs=[F("How far back do I need to file?", "It depends on your situation. Many people need only the last six years to be considered in compliance, but some situations call for more. We tell you after reviewing your transcripts."),
               F("Will I get refunds for old years?", "Only within the refund deadline. Refunds for older years are generally lost, but filing still matters because it starts the clock on the IRS's time to assess."),
               F("Can a 1040-X be e-filed?", "For recent years, yes, when the original return was e-filed. We e-file whenever we can because it is processed faster and tracked more easily."),
               F("I don't have my old W-2s.", "We don't need them. The IRS transcript shows what employers reported, and that's what we work from.")]),
    dict(slug="state", name="State and multi-state returns", audience="individuals", from_price="From $95 per added state", icon="map",
         short="Resident, part-year and nonresident state returns, with credits for tax paid to other states.",
         forms=["1040", "Schedule A", "1099-G", "W-2"],
         cites=cites("salt", "1099g", "x_state"),
         body=[
             S("What's included",
               "Your resident Oregon return is included in our individual fee. Each additional state is $95 for a nonresident or part-year return, and includes the credit for taxes paid to another state where it applies. Business multi-state filings are quoted with the business return."),
             S("Who it's for",
               "People who moved during the year, commute across a state line, work remotely for an employer in another state, own rental property in another state, or receive K-1s showing income from several states."),
             S("How it works", kind="steps", *[
                 "We review your W-2s, K-1s and moving dates to decide which states need a return.",
                 "We allocate income by state using days worked, property location or the K-1 state schedules.",
                 "We prepare the resident return last, so the credit for tax paid to other states is correct.",
                 "We e-file every state return together with your federal return."]),
             S("How states affect the federal return",
               "State and local income and property taxes are deductible on Schedule A if you itemize, generally limited to $40,000 ($20,000 if married filing separately) [1]. If you deducted state tax and received a refund the next year, part or all of that refund may be taxable [2]; we check it from your Form 1099-G and the prior-year return. If a federal return is amended, the state return often needs amending too [3]."),
             S("What to bring", kind="list", *[
                 "Moving dates and old and new addresses.",
                 "W-2s showing state wages for each state.",
                 "Any state estimated payments, with dates.",
                 "Form 1099-G for state refunds received during the year."]),
         ],
         faqs=[F("I work remotely for a company in another state. Do I file there?", "Sometimes. Some states tax nonresidents who work for in-state employers even if the work is done elsewhere. We check your employer's state and your W-2 withholding."),
               F("Will I be taxed twice?", "Usually not. Your resident state generally gives a credit for tax paid to the other state on the same income."),
               F("I moved in the middle of the year. How many returns?", "Usually two part-year returns, one for each state, with income split by the date you moved.")]),
    dict(slug="trusts-estates", name="Trusts and estates", audience="individuals", from_price="From $950", icon="landmark",
         short="Fiduciary income tax returns (Form 1041), final individual returns, and coordination with estate attorneys on Forms 706 and 709.",
         forms=["1041", "Schedule K-1 (1041)", "1040 (final)", "706", "709", "56"],
         cites=cites("1041_600", "1041_due", "706_due", "form56"),
         body=[
             S("What's included",
               "Form 1041 for estates and trusts from $950, including beneficiary K-1s; the decedent's final Form 1040 from $425; and gift tax returns (Form 709) from $650. We work with your estate attorney on the federal estate tax return (Form 706) and prepare the income tax and accounting schedules it needs."),
             S("Who it's for",
               "Executors and personal representatives, trustees of family and special-needs trusts, and families settling an estate. Our trusts and estates work is led by Lindiwe Okonkwo-Hart, CPA."),
             S("How it works", kind="steps", *[
                 "We meet with the executor or trustee to list assets, income and the tax years involved.",
                 "We get an EIN for the estate or trust if there isn't one, and file Form 56 to notify the IRS of the fiduciary relationship [4].",
                 "We set up a simple ledger of income, expenses and distributions.",
                 "We prepare the final 1040, the 1041s and the K-1s, and advise on the timing of distributions.",
                 "When the estate closes, we file the final 1041 and give the beneficiaries their final K-1s."]),
             S("Filing requirements and deadlines",
               "An estate with gross income of $600 or more in a tax year must file Form 1041 [1]. For a calendar-year estate, the 2025 return was due April 15, 2026 [2]; an estate can also choose a fiscal year, which sometimes helps with the timing of distributions. If a federal estate tax return is required, it and any tax are due 9 months after the date of death [3]."),
             S("What to bring", kind="list", *[
                 "Death certificate and letters testamentary, or the trust document and any amendments.",
                 "Date-of-death statements for every account and appraisals for real estate.",
                 "Income records after the date of death: 1099s issued to the estate or trust.",
                 "A list of distributions to beneficiaries, with dates and amounts.",
                 "The decedent's last two income tax returns."]),
         ],
         faqs=[F("Does every estate owe estate tax?", "No. Most estates owe no federal estate tax. Many still need income tax returns, because assets earn interest, dividends or rent while the estate is open."),
               F("Who signs the returns?", "The executor or personal representative for an estate, and the trustee for a trust."),
               F("Can beneficiaries be taxed on estate income?", "Yes. Income distributed to beneficiaries is generally reported to them on Schedule K-1 and taxed on their own returns."),
               F("Do you value assets?", "No. We work with appraisers and use the date-of-death values they and the financial institutions provide.")]),
    dict(slug="nonprofit", name="Nonprofit returns", audience="businesses", from_price="From $150 (990-N)", icon="heart-handshake",
         short="Form 990-N, 990-EZ and full Form 990 for charities, clubs and foundations, with payroll and bookkeeping if you need them.",
         forms=["990", "990-EZ", "990-N", "990-T", "8868", "941", "W-2"],
         cites=cites("990due", "501c3_futa"),
         body=[
             S("What's included",
               "Form 990-N e-Postcard filing, $150. Form 990-EZ, from $650. Full Form 990 with the schedules your organization needs, from $1,200. Unrelated business income returns (Form 990-T) are quoted separately. Every return includes a review meeting with your treasurer or board finance committee."),
             S("Who it's for",
               "Small and mid-sized charities, parent-teacher organizations, clubs, churches with employees, and private foundations. If your organization has paid staff we can run payroll as well."),
             S("How it works", kind="steps", *[
                 "We confirm which form your organization files, based on gross receipts and assets.",
                 "You send the year-end financial statements, board list and program information.",
                 "We prepare the return and the narrative sections, and send a draft to your board for review.",
                 "After board review, an officer signs and we e-file."]),
             S("Deadlines and payroll",
               "For a calendar-year exempt organization, returns are due on the 15th day of the 5th month after the year ends [1], which is May 15 (moved to the next business day if it falls on a weekend or holiday). We file the extension, Form 8868, when the books aren't final.",
               "Charities that pay staff still run payroll and file Forms 941 and W-2. Most 501(c)(3) organizations don't pay federal unemployment tax [2], which we confirm when we set up payroll."),
             S("What to bring", kind="list", *[
                 "Year-end financial statements or your bookkeeping file.",
                 "Board and officer list, with compensation if any.",
                 "Your IRS determination letter and the prior year's return.",
                 "A list of grants made or received and major donors (for Schedule B, which isn't made public)."]),
         ],
         faqs=[F("We're very small. Do we still file?", "Yes. Most small exempt organizations file at least the 990-N each year. Organizations that miss three years in a row lose exempt status automatically."),
               F("Is our return public?", "Yes, most of it. Donor names and addresses on Schedule B are kept confidential for most organizations."),
               F("Can you help with our 501(c)(3) application?", "Yes. Form 1023-EZ preparation is $450 and the full Form 1023 is quoted separately."),
               F("Do you audit nonprofits?", "No. We prepare returns and keep books, but we don't perform financial statement audits.")]),
]

# ---------------------------------------------------------------------------------------------------------------------
# Industries
# ---------------------------------------------------------------------------------------------------------------------
INDUSTRIES = [
    dict(slug="rideshare-gig", name="Rideshare and gig workers", icon="car",
         short="Drivers, couriers and platform workers: 1099-K and 1099-NEC income, mileage, and quarterly payments.",
         cites=cites("1099k", "mile", "mile_records", "se_rate"),
         body=[
             S("What we see",
               "Platform income arrives on Form 1099-K or 1099-NEC, or on no form at all. For 2025, apps and marketplaces had to send a 1099-K only when business payments were more than $20,000 [1], so many part-time drivers get nothing and still owe tax on what they earned. The 1099-K figure is usually gross fares before platform fees, which are a deductible expense.",
               "Mileage is normally the largest deduction. The 2025 standard rate is 70 cents a mile [2], and the record has to show the mileage for each business use and the total miles for the year [3]. App summaries tend to miss miles driven between trips; your own log closes the gap.",
               "Self-employment tax at 15.3% [4] comes on top of income tax, so first-year drivers who don't make estimated payments are often surprised in April."),
             S("How we work with you",
               "We reconcile each platform's annual tax summary to the 1099s, add your mileage and other expenses, and file Schedule C and Schedule SE with your 1040. If you'll keep driving, we set up quarterly payments so next April is uneventful."),
             S("What to bring", kind="list", *[
                 "Every 1099-K and 1099-NEC, plus each app's annual tax summary.",
                 "Your mileage log or tracking-app export.",
                 "Phone bills, tolls, parking and supply receipts.",
                 "Any estimated payments made."]),
         ],
         faqs=[F("Do I need a separate bank account?", "It isn't required, but it makes your records much easier and is the first thing we recommend."),
               F("Can I deduct my car payment?", "Not directly. You deduct either the standard mileage rate or the business share of actual costs, including depreciation and business-use interest."),
               F("I drive for two apps at once. How do I count miles?", "Count each mile once. A single log covering all apps is better than separate logs that overlap.")]),
    dict(slug="real-estate", name="Rental property owners", icon="home",
         short="Landlords with one rental or twenty: depreciation, passive loss limits, short-term rentals and property sales.",
         cites=cites("rent_275", "rent_land", "rent_25k", "rent_personal"),
         body=[
             S("What we see",
               "Depreciation set up wrong on the first return and carried forward for years. Residential rental buildings are depreciated over 27.5 years [1], and only the building, not the land, is depreciable [2]. We split the purchase price using the county assessment or an appraisal and fix earlier schedules where needed.",
               "Losses that can't be used. Rental losses are generally passive, but owners who actively participate may deduct up to $25,000 of rental loss against other income [3], subject to an income phase-out. We track suspended losses year to year so none are lost when you sell.",
               "Vacation homes and short-term rentals with personal use, where expenses must be divided between rental and personal use [4], and short-term rentals with average stays of seven days or less, which follow different rules altogether.",
               "Repairs versus improvements. A new roof is depreciated; patching the old one is deducted. We review large invoices each year."),
             S("How we work with you",
               "Hana Nakashima, CPA, leads our real estate work from the Millbrook Crossing office. We keep a depreciation schedule for each property, review cost-segregation studies when the numbers justify one, and plan sales and 1031 exchanges with you before closing, not after."),
             S("What to bring", kind="list", *[
                 "Closing statements for any purchase, sale or refinance.",
                 "Rent rolls or the year-end statement from your property manager.",
                 "Mortgage interest (Form 1098), property tax and insurance statements.",
                 "Invoices over $2,500 for work on the property, so we can classify them.",
                 "Days of personal use, for vacation homes."]),
         ],
         faqs=[F("Should I put my rental in an LLC?", "That's mainly a liability question for your attorney. For federal tax, a single-member LLC is usually ignored and the rental stays on Schedule E."),
               F("What happens to depreciation when I sell?", "Depreciation you claimed, or could have claimed, is generally taxed on sale at a separate rate. We estimate it before you list."),
               F("Do you prepare 1031 exchanges?", "We report them and plan the numbers; a qualified intermediary has to hold the funds.")]),
    dict(slug="restaurants", name="Restaurants and food service", icon="utensils",
         short="Cafés, restaurants and bars: tip reporting, Form 8027, the FICA tip credit, payroll and sales-heavy bookkeeping.",
         cites=cites("tips_large", "tips_alloc", "45b", "tips_20"),
         body=[
             S("What we see",
               "Tip reporting gaps. Employees who receive $20 or more in tips in a month and don't report them to you owe Social Security and Medicare tax on the unreported tips on their own returns [4]. Your payroll has to include reported tips, and your point-of-sale reports need to match.",
               "Form 8027. A large food or beverage establishment is one that serves food or drink for consumption on the premises, where tipping is customary, and that normally had more than 10 employees on a typical business day in the preceding year [1]. If total reported tips fall below the required share of gross receipts, tips are allocated by hours worked, gross receipts or a good-faith agreement [2].",
               "Unclaimed tip credit. The credit on Form 8846 generally equals the employer's share of Social Security and Medicare tax paid on employees' tips [3], and it is easy to miss without payroll reports that separate tips.",
               "Cash-heavy deposits, delivery-platform payouts net of fees, and food-cost categories that don't match the menu."),
             S("How we work with you",
               "Elspeth Brannigan's bookkeeping team closes restaurant books weekly from your point-of-sale and delivery reports. Saoirse Dunleavy runs payroll with tips reported correctly, and we calculate the tip credit and prepare Form 8027 each year."),
             S("What to bring", kind="list", *[
                 "Point-of-sale summaries by month, with charge and cash tips.",
                 "Delivery-platform statements.",
                 "Payroll reports showing tips reported by each employee.",
                 "Vendor invoices for food and beverage."]),
         ],
         faqs=[F("Are service charges the same as tips?", "No. A mandatory service charge is wages paid by you, not a tip, and is handled differently in payroll."),
               F("Do I need to file Form 8027?", "Only if you meet the large food or beverage establishment test. We check your headcount and tipping practices each year.")]),
    dict(slug="contractors", name="Contractors and trades", icon="hard-hat",
         short="Builders, electricians, plumbers and landscapers: worker classification, 1099s, equipment and job costing.",
         cites=cites("control", "nec2000", "179"),
         body=[
             S("What we see",
               "Workers paid as contractors who are really employees. If you have the right to control what is done and how it is done, the worker is generally your employee [1]. Getting this wrong means back payroll taxes and penalties. We review your crew arrangements when you start with us.",
               "Missing 1099s. Subcontractors you pay for services need a Form 1099-NEC; for payments after 2025 the reporting threshold is $2,000 [2]. Collect a W-9 before the first payment, not in January.",
               "Equipment and trucks. For 2025 the maximum section 179 deduction is $2,500,000 [3], but expensing everything in a strong year can leave nothing for a weaker one. We plan purchases and depreciation together.",
               "Job costing and work-in-progress that make the year's profit look wrong, and mileage from home to job sites."),
             S("How we work with you",
               "Rafael Echeverría-Lund, EA, works with contractors from our Corbel Point office. We set up job-level bookkeeping, review classification and 1099s, and prepare the Schedule C or entity return with a depreciation plan for the next few years."),
             S("What to bring", kind="list", *[
                 "W-9s and payment totals for each subcontractor.",
                 "Invoices for equipment, tools and vehicles bought or sold.",
                 "Mileage records for each vehicle.",
                 "Your contractor license and insurance details for the file."]),
         ],
         faqs=[F("My helpers want to be paid as contractors. Is that okay?", "Their preference doesn't decide it. If you control how and when they work, they are likely employees."),
               F("Can I deduct my work truck?", "Yes, in proportion to business use. Heavy trucks have different depreciation limits from cars, which we check for each vehicle.")]),
    dict(slug="medical", name="Medical and dental practices", icon="stethoscope",
         short="Physicians, dentists and therapists in private practice: entity choice, payroll, retirement plans and practice bookkeeping.",
         cites=cites("doctors", "sep", "addl"),
         body=[
             S("What we see",
               "Practice owners who are self-employed for tax purposes. Doctors and others in an independent profession who offer services to the public are usually not employees [1], so practice income lands on Schedule C or flows through a partnership or S corporation. Entity choice and owner salary make a large difference.",
               "Retirement plans chosen without checking the numbers. A SEP IRA allows employer contributions of up to 25% of compensation, up to $70,000 for 2025 [2], but must cover eligible staff on the same terms. A 401(k) with a profit-sharing feature is often a better fit for a practice with employees.",
               "High earners caught by the Additional Medicare Tax, which employers withhold at 0.9% on wages above $200,000 [3], and by surprise balances when a spouse's income is added in.",
               "Insurance receivables, credit-card merchant deposits net of fees, and equipment purchases that need depreciation planning."),
             S("How we work with you",
               "Kwame Mensah-Ortiz keeps practice books from the Corbel Point office, and Desmond Whitlow, CPA, handles entity and compensation planning. We meet each fall to set owner salary and retirement contributions."),
             S("What to bring", kind="list", *[
                 "Practice management system reports of collections by month.",
                 "Payroll reports and retirement plan contribution reports.",
                 "Equipment invoices and leases.",
                 "Malpractice insurance and continuing-education receipts."]),
         ],
         faqs=[F("Should my practice be an S corporation?", "Often yes once profit is well above a reasonable salary for your specialty, but it depends on state costs and benefits. We run the comparison first."),
               F("Can you handle a practice with two owners?", "Yes. Partnerships and multi-owner S corporations need clear agreements on compensation and distributions, and we help keep them consistent with the returns.")]),
    dict(slug="crypto", name="Crypto and digital assets", icon="bitcoin",
         short="Buyers, sellers, stakers and miners: Form 1099-DA, cost basis, Form 8949 and the digital asset question.",
         cites=cites("da_def", "da_1099", "da_basis", "da_question"),
         body=[
             S("What we see",
               "Digital assets are any digital representations of value recorded on a cryptographically secured distributed ledger [1]. That includes cryptocurrencies, stablecoins and NFTs, and all of them follow the same reporting rules.",
               "Form 1099-DA is new. For 2025, a broker that handled a sale should send a Form 1099-DA reporting the transaction [2], but for 2025 the broker may leave cost basis off [3]. Without basis, the IRS sees the whole sale price as gain. We rebuild basis from exchange histories and wallet records.",
               "The yes/no question on the front of Form 1040. You must answer it whether or not you received a 1099-DA [4]. Receiving crypto as pay, staking rewards, mining income, swapping one token for another, and spending crypto on goods all generally mean answering yes.",
               "Transfers between your own wallets reported as sales, and exchanges that closed and took their records with them."),
             S("How we work with you",
               "We import exchange and wallet histories into reconciliation software, match transfers, and produce Form 8949 with a basis report you keep for your records. Staking and mining income is reported as ordinary income when received, and mining as a business when it is run as one."),
             S("What to bring", kind="list", *[
                 "Every Form 1099-DA, 1099-B and 1099-MISC from exchanges.",
                 "CSV exports of full transaction history from each exchange.",
                 "Public wallet addresses you control.",
                 "Prior-year crypto reports, if another preparer made them."]),
         ],
         faqs=[F("I only bought and held. Do I report anything?", "Buying with dollars and holding generally doesn't require a 'yes' answer on its own, but keep the records; they set your basis for the future."),
               F("What does reconciliation cost?", "From $250 for up to 500 transactions; larger histories are quoted after we see the exports.")]),
]

# ---------------------------------------------------------------------------------------------------------------------
# Articles (600-900 words each; checked below)
# ---------------------------------------------------------------------------------------------------------------------
ARTICLES = [
    dict(slug="estimated-tax-payments-2026-2027", author_id="st-ivo", published="2026-08-18", category="Planning",
         title="Estimated tax payments for 2026 and 2027: who pays, how much, and when",
         summary="The two-part test for who must pay, the safe harbors that prevent a penalty, and the payment dates for tax years 2026 and 2027.",
         tags=["estimated tax", "1040-ES", "self-employed", "safe harbor"],
         cites=cites("est1000", "est90", "est110", "estdates", "estjan"),
         body=[
             S(None,
               "If you have income that nobody withholds tax from, the IRS still expects to be paid during the year, not in one lump in April. Estimated payments are how you do that. This note covers who has to make them, how to choose an amount that avoids the underpayment penalty, and the payment dates for tax years 2026 and 2027."),
             S("Who has to pay",
               "Most people who need to make estimated payments are self-employed, own rental property, sell investments at a gain, or take retirement distributions with little or no withholding. The test in Publication 505 has two parts. The first is a threshold: you expect to owe at least $1,000 in tax for 2026 after subtracting withholding and credits [1].",
               "The second part asks whether your withholding and credits will fall short of the smaller of two amounts: 90% of the tax on your 2026 return, or 100% of the tax on your 2025 return [2]. If both parts apply, you should be making payments.",
               "Wage earners with a side business can often skip quarterly payments by increasing withholding at their main job with a new Form W-4. Withholding is treated as paid evenly through the year no matter when it was taken out, which helps if you discover in October that you are behind."),
             S("Choosing an amount: the safe harbors",
               "The simplest way to avoid a penalty is to base your payments on last year's tax instead of guessing at this year's. If withholding and estimated payments together equal at least 100% of the tax shown on your 2025 return, paid on time across the four due dates, you are generally protected even if your 2026 income rises sharply.",
               "Higher earners have a stricter version. If your adjusted gross income for 2025 was more than $150,000, or $75,000 if you are married filing separately, the prior-year figure becomes 110% instead of 100% [3].",
               "The other route is 90% of this year's tax. It suits people whose income has dropped, but it depends on estimating 2026 income with some accuracy, so we pair it with a mid-year check. For clients with uneven income, such as a large stock sale in the fall, the annualized income installment method on Form 2210 can reduce or remove a penalty for the early quarters. It needs a quarter-by-quarter record of income, which we prepare from your books."),
             S("The 2026 and 2027 due dates",
               "For tax year 2026 the four payments are due April 15, 2026; June 15, 2026; September 15, 2026; and January 15, 2027. None of those dates falls on a weekend or holiday.",
               "For tax year 2027 the payments are due April 15, 2027; June 15, 2027; September 15, 2027; and, for the fourth payment, Tuesday, January 18, 2028. January 15, 2028 is a Saturday and Monday, January 17 is Martin Luther King Jr. Day, so the payment moves to the next business day. Publication 505 states the rule: when a due date falls on a Saturday, Sunday or legal holiday, a payment made on the next business day is on time [4].",
               "One exception to the January date is worth knowing. If you file your 2026 return by January 31, 2027 and pay the full balance, you don't need to make the January 15 payment [5]. That rarely works for anyone waiting on a K-1 or a corrected brokerage statement, but it can work for a simple Schedule C."),
             S("How to pay",
               "IRS Direct Pay and EFTPS both accept estimated payments and both give a confirmation number. Keep it. When we prepare your return we match each payment to your IRS account transcript, and a confirmation number settles any mismatch quickly. Paying by check with a Form 1040-ES voucher still works; allow mailing time and write your Social Security number and the tax year on the check.",
               "States run their own estimated tax systems with separate vouchers and payment portals. When we set up your federal payments we set up the state payments at the same time, so you have one schedule to follow."),
             S("What we do for clients",
               "For clients on our planning service, we calculate the four payments when we finish your return in the spring, using whichever safe harbor is easiest on cash flow. We revisit in late August, after the second payment, using year-to-date bookkeeping or pay stubs. If income has moved substantially, we adjust the September and January amounts instead of leaving a surprise for April.",
               "If you've already missed a payment this year, make it now rather than waiting for the next due date. The penalty is figured on each late installment for the time it is late, so a late payment costs less than no payment at all."),
         ]),
    dict(slug="standard-mileage-rate-records", author_id="st-gor", published="2026-08-25", category="Small business",
         title="The standard mileage rate and the records that support it",
         summary="How the business mileage rate works, the first-year choice that limits later years, which trips count, and what a mileage log has to show.",
         tags=["mileage", "vehicle", "records", "Schedule C"],
         cites=cites("mile", "mile_first", "commute", "mile_records", "no_estimate", "char14"),
         body=[
             S(None,
               "If you drive for your business, the vehicle deduction is often one of the larger items on your return, and one of the first things an examiner asks you to support. There are two ways to figure it: the standard mileage rate or actual expenses. Either way, the deduction rests on the same foundation, a record of business miles."),
             S("The rate",
               "For 2025, the business standard mileage rate is 70 cents per mile [1]. It covers gas, insurance, repairs, tires and depreciation in a single figure. Business parking fees and tolls are deductible on top of it.",
               "The IRS announces each year's rate around the end of the previous year. Our library holds the 2025 edition of Publication 463, so that is the figure we quote here and use in our mileage calculator. We will update both when the 2026 edition is published.",
               "Other rates exist for other purposes. Driving for a charity, for example, uses a rate of 14 cents a mile, and the record has to show the miles driven for the charitable purpose [6]."),
             S("Choosing a method",
               "The standard rate is simpler and is often larger for efficient cars driven many miles. Actual expenses can come out ahead for an expensive vehicle or one driven fewer miles. The choice isn't entirely free each year: to use the standard mileage rate for a car you own, you must choose it in the first year the car is used in your business [2]. After that you can move between methods, but switching from the standard rate to actual expenses limits how you can depreciate the car.",
               "When a client buys a vehicle, we run both methods for the first year before filing, because that first choice affects every year after it."),
             S("Which miles count",
               "Commuting is where most people go wrong. Driving between your home and your main or regular place of work is personal commuting [3], even if you take business calls on the way. Driving from your office to a client, between job sites, to a supplier, or to the bank to make a business deposit is business mileage. If your home office is your principal place of business, trips from home to other work locations generally count as business miles too.",
               "Rideshare and delivery drivers have an extra wrinkle. Miles driven with the app on, waiting for or heading to a pickup, are usually business miles, but the platform's summary may show only miles driven with a passenger or an order on board. Your own log fills that gap."),
             S("What the record needs to show",
               "Publication 463 lists what a vehicle record must show: the cost of the car and improvements, the date you started using it for business, the mileage for each business use, and the total miles for the year [4]. In practice that means a log with the date, destination, business purpose and miles for each trip, and odometer readings at the start and end of the year.",
               "A record made at the time is worth far more than one rebuilt later. The publication is plain that you can't deduct amounts you approximate or estimate [5]. A phone app that records trips automatically is fine, as long as you classify each trip and export the log at year end. A notebook in the glove box is fine too.",
               "Keep the log for at least three years after you file, and longer if you use actual expenses, because the car's depreciation affects the gain or loss when you sell or trade it in."),
             S("What we ask for",
               "When you send your organizer, we ask for total business miles, total miles, the date the vehicle was first used for business, and whether you used the standard rate in that first year. If you keep a log, we don't need to see every trip; we need to know it exists and that you could produce it if asked.",
               "If you have more than one vehicle, keep a separate log for each one. If two people share one vehicle for a business, one log with the driver noted on each trip is enough."),
         ]),
    dict(slug="cp2000-what-to-do", author_id="st-mva", published="2026-09-02", category="IRS notices",
         title="A CP2000 arrived. Here is what to do next",
         summary="Why the IRS sends a CP2000, what the notice proposes, the response deadline, and how to answer when it's right, partly right or wrong.",
         tags=["CP2000", "IRS notice", "underreported income", "1099"],
         cites=cites("cp_compare", "cp_notbill", "cp_30", "cp_disagree", "cp_interest", "cp_snod"),
         body=[
             S(None,
               "A CP2000 is one of the most common letters the IRS sends, and one of the most misunderstood. It usually arrives a year or more after you filed, and it lists income the IRS believes is missing from your return. It isn't an audit in the usual sense, and it isn't yet a bill. It does have a deadline."),
             S("Why you got one",
               "The IRS receives a copy of every W-2, 1099 and 1098 issued to you. An automated system compares those documents with your return to find mismatches [1]. Common triggers we see: a 1099-B for shares sold in an old brokerage account, a 1099-NEC from a one-off job, a 1099-R for a rollover reported without the rollover noted, a 1099-K from a payment app, or a 1099-INT from a bank account you'd forgotten.",
               "Sometimes the income was reported, just on a different line or under a business name, and the matching program didn't connect the two."),
             S("What the notice says",
               "The notice lists the amounts you reported, the amounts the payers reported, and the tax, interest and sometimes penalty the IRS proposes. In the IRS's own words, the CP2000 isn't a bill; it's a proposal to adjust your income, payments, credits or deductions [2]. Nothing has been assessed yet, which is why your response matters."),
             S("The deadline",
               "Respond within 30 days of the date printed on the notice, or 60 days if you live outside the United States [3]. The date on the notice starts the clock, not the day it reached your mailbox. If you need more time to gather documents, call the number on the notice before the deadline and ask; a short extension is often granted by phone.",
               "If you don't respond at all, the next letter is a Statutory Notice of Deficiency [6]. It carries its own strict deadline and is much harder to unwind."),
             S("If the notice is right",
               "Sign the response form agreeing to the changes and return it, with payment if you can. Paying the proposed amount within 30 days stops further interest, and possibly further penalties, from building up [5]. If you can't pay in full, you can agree to the changes and ask for a payment plan at the same time.",
               "If you agree that the income was missing but you also have deductions or basis that offset it, a partial agreement with an explanation is usually better than simply signing."),
             S("If it's wrong, or partly wrong",
               "Mark the box saying you disagree and send a signed statement explaining why, with supporting documents [4]. Be specific. “I already reported this” isn't enough; show where. For example: the $6,400 of 1099-NEC income on the notice is included in the $48,210 of gross receipts on Schedule C, line 1, and the attached ledger lists it.",
               "For brokerage sales, the usual problem is cost basis. If the 1099-B shows proceeds with no basis, the IRS computes tax on the whole sale price. Your purchase confirmations, or a basis statement from the broker, usually resolve it.",
               "Send your response by a method the notice lists, keep a copy of everything you send, and if you mail it, use a service with tracking."),
             S("When to bring us in",
               "Bring us the notice early, while there is still time to collect documents. We start by pulling your IRS wage-and-income transcript for the year, so we can see exactly what the IRS has, and compare it line by line with your return. With Form 2848 on file we can call the IRS for you and handle any follow-up letters.",
               "Our notice response fee starts at $250 for a single-issue CP2000, and we quote it before we start. If we prepared the return and the mismatch was our error, there is no charge for the response, and we pay any penalty that resulted from it."),
         ]),
    dict(slug="s-corp-reasonable-compensation", author_id="st-dwh", published="2026-09-10", category="Business tax",
         title="S corporation owners: reasonable compensation and payroll basics",
         summary="Why an S corporation owner who works in the business must take a salary, how we judge what's reasonable, and how owner payroll and health insurance work.",
         tags=["S corporation", "reasonable compensation", "payroll", "1120-S", "W-2"],
         cites=cites("officer", "scorp_wages", "scorp_2pct", "941_new", "ss26"),
         body=[
             S(None,
               "Many of our business clients elect S corporation status to reduce self-employment tax. The saving is real, but it depends on a rule new owners often learn late: if you work in the business, the corporation must pay you a salary through payroll before it pays you distributions."),
             S("Why the salary is required",
               "When a business is incorporated, officers who work in it are employees of the corporation [1]. The Form 1120-S instructions are direct: distributions and other payments to an officer must be treated as wages to the extent they are reasonable compensation for the officer's services [2]. Wages go through payroll, with income tax withholding, Social Security and Medicare, and a W-2 at year end. Distributions don't.",
               "An owner who takes everything as distributions and no salary fits the pattern the IRS looks for. If an examiner reclassifies distributions as wages, the corporation owes the employment taxes it should have withheld and paid, plus penalties and interest."),
             S("What “reasonable” means",
               "There is no published percentage or formula. The question is what the business would have to pay someone else to do the work you do. We look at your role and hours, since an owner who manages staff and does the billable work is in a different position from one who is mainly an investor; what comparable positions pay locally, using wage data for the actual job; the business's revenue and profit, because a salary that leaves the company unable to pay its bills isn't reasonable either; and what you were paid before the election, if you did the same work then.",
               "We write the reasoning down in a short memo each year and keep it with the return. If the salary is ever questioned, a written rationale prepared at the time carries much more weight than one put together after a letter arrives."),
             S("Running payroll for yourself",
               "Owner payroll is ordinary payroll. You need a Form W-4 on file, regular pay dates, withholding, tax deposits, quarterly Forms 941, an annual Form 940 and a W-2. For 2026 the Social Security rate is 6.2% each for employee and employer on wages up to $184,500 [5], and Medicare applies to all wages. A new corporation is a monthly schedule depositor in its first calendar year [4], which keeps the deposit calendar simple while you get started.",
               "Paying yourself once a quarter is allowed, but regular pay dates make deposits and personal tax planning easier. Most of our S corporation clients run owner payroll monthly."),
             S("Health insurance and other benefits",
               "Shareholders who own more than 2% are treated differently for fringe benefits. The corporation includes health insurance premiums it pays for a more-than-2% shareholder as wages in box 1 of the W-2 [3], and the shareholder may then be able to deduct them on the personal return. If the premiums don't go through payroll correctly, that deduction can be lost. We set this up with the payroll provider at the start of the year rather than correcting W-2s in January."),
             S("Mistakes we fix most often",
               "Electing S status partway through the year and forgetting to start payroll. Paying a salary but not making the federal deposits. Treating personal expenses paid by the corporation as neither wages nor distributions. Taking distributions out of proportion to ownership when there are two or more shareholders, which can put the S election itself at risk."),
             S("Where to start",
               "If you have an S corporation and no owner payroll, or you're considering the election, book a planning meeting. We will estimate a salary range, show you the tax difference in dollars, and set up payroll through our payroll service if you'd like us to run it. If prior years were done without payroll, we'll explain the options for correcting them before the IRS raises the question."),
         ]),
    dict(slug="home-office-deduction", author_id="st-pra", published="2026-09-17", category="Small business",
         title="The home office deduction: who qualifies and how it's figured",
         summary="The exclusive-use and principal-place-of-business tests, the simplified and regular methods, and what to keep if you claim the deduction.",
         tags=["home office", "8829", "simplified method", "self-employed"],
         cites=cites("ho_excl", "ho_partition", "ho_both", "ho_ppb", "ho_simpl", "ho_300"),
         body=[
             S(None,
               "The home office deduction is for self-employed people who use part of their home for their business. Employees who work from home for an employer generally can't claim it under current law, even when the employer requires it. For business owners who qualify, it can be worth claiming every year, but the tests are stricter than many people expect."),
             S("Exclusive and regular use",
               "You must use a specific area of your home only for your trade or business [1]. A spare bedroom used as an office qualifies; a dining table cleared off each morning doesn't. The area can be a room or a separately identifiable space, and it doesn't need a permanent partition [2], so a clearly defined part of a larger room can work.",
               "Using the same area for business and for personal purposes fails the test [3]. A guest bed in the office, or the family computer on the same desk, is the usual problem. The space also has to be used regularly, not occasionally.",
               "There are narrow exceptions to exclusive use for storing inventory or product samples and for a licensed daycare, which follow their own rules."),
             S("Principal place of business",
               "The office must also be your principal place of business, a place where you meet clients in the normal course of business, or a separate structure used for the business. Under the principal place of business test, your home must be the principal place of business for that trade or business [4].",
               "A home office can qualify even if most of the actual work happens elsewhere, as long as you use it for administrative or management work and have no other fixed location where you do much of that work. Contractors who do their estimates, invoicing and scheduling from home are the common example."),
             S("Two ways to figure the deduction",
               "The simplified method multiplies $5 by the square footage of the office [5], with the area limited to 300 square feet [6], so the most it can produce is $1,500. There is no depreciation and nothing to recapture when you sell the house, and mortgage interest and property taxes stay fully deductible on Schedule A if you itemize.",
               "The regular method uses the business percentage of the home, which is the office's square footage divided by the home's total, applied to actual costs: rent or mortgage interest, property tax, insurance, utilities, repairs, and depreciation on the business part of a home you own. It is reported on Form 8829. It often gives a larger deduction for a high-cost home, but it involves depreciation, which affects the tax when you sell, and it requires keeping the bills.",
               "You can choose the method each year. For renters, the regular method usually wins, because rent is a large expense and there is no depreciation to recapture."),
             S("The income limit",
               "Under either method the deduction can't create or increase a loss from the business. Under the regular method, expenses disallowed by that limit carry forward to the next year; under the simplified method they don't. If your business is new or had a weak year, we check which method leaves you better off over two or three years, not just this one."),
             S("What to keep",
               "The square footage of the office and of the whole home; a floor plan sketch or a photo for the first year you claim it; for the regular method, a year of utility bills, rent records or the mortgage interest statement (Form 1098), the property tax bill and the insurance declarations page; and the date you started using the space for business.",
               "If you sell a home where you claimed the regular method, tell us when you list it. The depreciation you claimed affects the gain and how much of it the home sale exclusion covers, and it is much easier to plan for before closing than after."),
         ]),
    dict(slug="irs-payment-plans-form-9465", author_id="st-mva", published="2026-09-24", category="IRS notices",
         title="Can't pay the full balance? How IRS payment plans work",
         summary="Short-term plans, online agreements and Form 9465, choosing a monthly amount, direct debit, and keeping a plan in good standing.",
         tags=["payment plan", "installment agreement", "9465", "balance due"],
         cites=cites("9465_180", "9465_50k", "9465_fee", "9465_guar", "9465_accrue", "9465_dd"),
         body=[
             S(None,
               "Owing more than you can pay at once is common, and the IRS has standard arrangements for it. The worst choice is the one many people make: not filing because they can't pay. Filing on time and setting up a payment plan costs far less, because the penalty for filing late is much larger than the penalty for paying late."),
             S("Short-term: paying within 180 days",
               "If you can pay the full balance within 180 days, you can avoid the setup fee by calling the IRS [1]. Interest and the late-payment penalty still accrue until the balance is paid, but there is no user fee and no formal agreement to monitor. For many clients, a refund expected next spring, a year-end bonus or a planned sale makes this the right choice."),
             S("Longer plans: online or Form 9465",
               "If you need longer, you are asking for an installment agreement. If your combined tax, penalties and interest is $50,000 or less, you can apply online through the IRS Online Payment Agreement tool instead of filing Form 9465 [2]. The online route costs less: the user fee for a plan set up through the online application is lower than otherwise [3].",
               "Form 9465 is the paper version. It asks for the amount you owe, the monthly payment you propose, the day of the month you want to pay, and bank details if you choose direct debit. For larger balances, the IRS may ask for a financial statement such as Form 433-F before it approves the plan.",
               "There is also a guaranteed installment agreement for individuals who owe $10,000 or less in tax, not counting interest and penalties [4], and who meet conditions about filing and paying on time in earlier years."),
             S("Choosing the monthly amount",
               "Pay as much as you can sustain. Interest and penalties continue until the balance is paid in full [5], so a larger payment over a shorter period costs less overall. We usually aim for a plan that ends before the next year's return is due, so you aren't carrying two years of balances at once.",
               "Be realistic. A plan you can keep is better than an ambitious one you default on in month four."),
             S("Direct debit",
               "We recommend direct debit to almost every client. Automatic payments from a bank account help make sure a payment isn't missed and the plan doesn't default [6]. Lower-income taxpayers who choose direct debit can also have the user fee waived."),
             S("Keeping the plan in good standing",
               "A payment plan has conditions beyond the monthly payment. You must file every future return on time and pay future taxes in full, which for self-employed clients means making estimated payments. A missed payment or a new unpaid balance can put the agreement in default. If your circumstances change, contact the IRS, or us, before you miss a payment; plans can usually be revised.",
               "While the plan is in place, any refund on a future return is generally applied to the balance, so plan your withholding accordingly."),
             S("Business payroll taxes are different",
               "A business that is still operating and owes payroll taxes can't use Form 9465; it has to call the number on its most recent notice. Unpaid withheld taxes can also become a personal liability for the people responsible for paying them. If you are behind on Form 941 deposits, call us this week, not next quarter."),
             S("How we help",
               "We work from your IRS account transcript, propose a payment the IRS will accept, and submit the request under our power of attorney. If no plan is affordable, we look at whether currently-not-collectible status or an offer in compromise is a better fit and explain what each requires.",
               "Our fee for setting up a payment plan starts at $250 and is quoted after we review your transcript. Bring every notice you have received about the balance, your most recent return, and a rough monthly budget, so we can propose a payment you can actually keep."),
         ]),
    dict(slug="amended-returns-1040x", author_id="st-tbi", published="2026-10-01", category="Individuals",
         title="Amending a return with Form 1040-X: when it's worth it and how long it takes",
         summary="Which mistakes need an amended return, the refund deadline, e-filing and processing times, and the penalty for overclaiming.",
         tags=["amended return", "1040-X", "refund", "prior year"],
         cites=cites("x_after", "x_3yr", "x_sep", "x_time", "x_penalty"),
         body=[
             S(None,
               "Found a missing 1099, a credit you didn't claim, or a dependent who should have been on the return? Most errors on a filed return are fixed with Form 1040-X. A few aren't, and when you're owed money, timing matters."),
             S("When you don't need to amend",
               "Arithmetic mistakes are usually corrected by the IRS during processing, and if a schedule or form is missing the IRS will normally ask for it by letter. If you receive a CP2000 about unreported income, follow the instructions in the notice rather than filing an amendment on your own; the notice explains when a 1040-X belongs with your response.",
               "Small differences that change nothing, such as a typo in an employer's address, don't need an amendment either."),
             S("When you should",
               "Common reasons we file amendments: a corrected W-2 or 1099 arrives after you filed; income was left off; a dependent or filing status was wrong; a credit was missed, such as an education credit for a 1098-T that came late; or a K-1 arrived after filing and changes your income. You can amend only after the original return has been filed [1]."),
             S("Deadlines for refunds",
               "To get money back, file the 1040-X within 3 years after you filed the original return or within 2 years after you paid the tax, whichever is later [2]. A return filed early is treated as filed on its due date. So a 2023 return filed before its April 2024 due date can generally be amended for a refund until April 2027.",
               "If the amendment means you owe more, there is no deadline to protect, but don't wait. Interest runs from the original due date, and correcting the return yourself is better than having the IRS find the error."),
             S("How it's filed",
               "Each year needs its own Form 1040-X [3]. Recent years can usually be filed electronically if the original was e-filed, and that's how we file them. Attach any new or changed forms and schedules, and explain each change briefly in Part II. If the change affects your state return, the state usually needs its own amended return as well, and we file both together."),
             S("Processing time",
               "Expect 8 to 12 weeks, and in some cases up to 16 [4]. The IRS's Where's My Amended Return tool shows the status, but it can take a few weeks after filing before the return appears there. If you owe additional tax, pay it when you file to stop interest from building."),
             S("Don't overreach",
               "A refund claim for more than the correct amount can bring a penalty of 20% of the amount disallowed [5]. When a claim depends on a judgment call, such as whether an expense was ordinary and necessary or what donated property was worth, we document it before filing, not after a letter arrives."),
             S("Prior-year returns that were never filed",
               "An amendment fixes a return that exists. If a year was never filed, the fix is an original return for that year, prepared with that year's forms and rules. We usually start by pulling your IRS wage-and-income transcripts, which show the W-2s and 1099s the IRS has on record, so the return matches what the IRS already knows."),
             S("What it costs",
               "Our fee for an amended individual return starts at $275 per year, including the state amendment where one is needed. If we prepared the original return and the error was ours, there's no charge. Send us the return, the new or corrected documents, and any IRS letter, and we'll tell you whether an amendment is worth filing before we start.",
               "Sometimes the honest answer is that it isn't. If a missed deduction would change your tax by a few dollars, or a refund claim would rest on records you no longer have, we will say so and explain the reasoning, rather than charge you to file a return that gains nothing."),
         ]),
    dict(slug="form-941-deposits-new-employers", author_id="st-sdu", published="2026-10-08", category="Payroll",
         title="Form 941 deposit schedules for new employers",
         summary="The quarterly return versus deposits, monthly and semiweekly schedules, the $100,000 next-day rule, and how a new employer gets started.",
         tags=["941", "payroll", "deposits", "EFTPS", "new employer"],
         cites=cites("941_due", "941_lookback", "941_new", "941_monthly", "941_semi", "941_100k"),
         body=[
             S(None,
               "Hiring your first employee adds a second calendar to your business: payroll tax deposits. The tax you withhold from paychecks isn't simply paid with Form 941 at the end of each quarter. Most of it has to be deposited sooner, on a schedule the IRS sets. Missed deposits are among the most expensive mistakes a small business can make."),
             S("Form 941 versus deposits",
               "Form 941 is the quarterly report of wages paid, federal income tax withheld, and Social Security and Medicare taxes. It is due by the last day of the month after each quarter ends [1]: April 30, July 31, October 31 and January 31, moved to the next business day when the date falls on a weekend or legal holiday. October 31, 2026 is a Saturday, so the third-quarter 2026 return is due Monday, November 2.",
               "Deposits are the actual payments of those taxes, made electronically. Your deposit schedule says how soon after each payday the money must reach the Treasury."),
             S("Monthly or semiweekly",
               "There are two schedules, and the IRS assigns yours based on a lookback period. If you reported $50,000 or less in taxes during the lookback period, you're a monthly schedule depositor; if more, you're a semiweekly schedule depositor [2]. A new business has no history, so its tax in the lookback period counts as zero and it is a monthly depositor for its first calendar year [3].",
               "Monthly: deposit the taxes for all paydays in a month by the 15th day of the following month [4]. Wages paid on June 5 and June 20 are deposited together by July 15.",
               "Semiweekly: for paydays on Wednesday, Thursday or Friday, deposit by the following Wednesday [5]; for paydays on Saturday through Tuesday, deposit by the following Friday. The name is misleading. The schedule follows your paydays, not a twice-weekly calendar."),
             S("The $100,000 rule",
               "One rule overrides both schedules. If you accumulate $100,000 or more in taxes on any day during a deposit period [6], the deposit is due by the next business day, and a monthly depositor becomes a semiweekly depositor. A small employer rarely gets there, but a large bonus payroll can."),
             S("Very small employers",
               "Employers with a very small quarterly liability can sometimes pay with the return instead of depositing. We don't rely on that for new clients, because one larger payroll can push you past the limit without warning, and a deposit that should have been made is late from that day."),
             S("How deposits are made",
               "Federal tax deposits are made electronically, usually through EFTPS. New employers who indicated a federal tax obligation when they applied for an EIN are pre-enrolled and receive a PIN by mail. If you use a payroll provider, confirm in writing whether it makes the deposits for you or only calculates them. We see both arrangements, and the second is where most missed deposits come from."),
             S("Don't forget FUTA and the state",
               "Federal unemployment tax, reported on Form 940, has its own quarterly deposit rule, and your state has separate withholding and unemployment accounts with their own registration and deadlines. Set them up before the first payroll, not after the first notice."),
             S("Why it matters",
               "Withheld income tax and the employee share of Social Security and Medicare are held in trust for the government. If they aren't paid, the IRS can assess a penalty personally against the owners or others responsible for paying them. A missed deposit is fixable if it's caught quickly; a missed quarter is much harder."),
             S("Our payroll service",
               "For $79 a month plus $6 per employee, we run payroll, make every deposit on the schedule the IRS assigns you, file Forms 941, 940 and W-2, and post each deposit confirmation to your portal. If you're about to hire your first employee, call us a few weeks before the first payday so the accounts are ready."),
         ]),
    dict(slug="rideshare-gig-income-records", author_id="st-rfe", published="2026-10-20", category="Small business",
         title="Rideshare and gig income: the records that make tax time simple",
         summary="Why gig work is a business, which forms platforms send, self-employment tax, mileage and other deductions, and a simple record-keeping system.",
         tags=["gig", "rideshare", "1099-K", "1099-NEC", "Schedule C", "delivery"],
         cites=cites("schc", "1099k", "se_rate", "mile", "records_supp", "se_400"),
         body=[
             S(None,
               "Driving for a rideshare app, delivering food, or picking up jobs through a platform makes you self-employed for those earnings. The platform is your customer, not your employer. That means no withholding, a Schedule C, self-employment tax, and records that you keep rather than the platform."),
             S("It's a business",
               "Gig work done regularly to make money is a business for tax purposes: an activity qualifies when your primary purpose is income or profit and you do it with continuity and regularity [1]. Income goes on Schedule C and so do the expenses. Report all of it, whether or not a form arrives."),
             S("The forms you might get",
               "Platforms report payments on Form 1099-K or Form 1099-NEC, depending on how payments flow. For 2025, payment apps and marketplaces had to send a 1099-K only if your business payments were more than $20,000 [2] across more than 200 transactions, so many part-time drivers receive no 1099-K at all. The income is taxable either way.",
               "The 1099-K figure is also gross. It usually includes the rider's full fare or the customer's full order before the platform's service fees and commissions. The app's annual tax summary breaks those out, and the fees are deductible. Bring the summary, not just the form.",
               "If a 1099-K includes personal payments, such as friends paying you back for dinner through the same app, that part isn't business income. We report the adjustment so the return still matches the form."),
             S("Self-employment tax",
               "Net profit from gig work is subject to self-employment tax once net earnings reach $400 [6]. The rate is 15.3%, made up of 12.4% for Social Security and 2.9% for Medicare [3]. It comes on top of income tax, and it is the main reason first-year drivers owe at filing time. Set aside part of every payout; after your first quarter we can work out the right percentage for you."),
             S("Mileage is the big deduction",
               "For most drivers the vehicle is the largest expense. The 2025 standard mileage rate is 70 cents per mile [4]. Miles driven while logged in and heading to a pickup count, as do miles between deliveries. The platform's own mileage figure often captures only miles with a passenger or order on board, so keep your own log or start a tracking app the moment you log in."),
             S("Other expenses",
               "The business share of your phone and data plan; platform and subscription fees; tolls and parking while working (parking tickets aren't deductible); car washes and supplies for passengers; insulated delivery bags; and the business share of roadside assistance. Keep a receipt or bank record for each. Receipts, paid bills, invoices and deposit slips are the supporting documents the IRS expects to see [5]."),
             S("Quarterly payments",
               "Because nothing is withheld, most full-time drivers need to make estimated tax payments in April, June, September and January. If you also have a job with a W-2, raising your withholding there can cover the gig income instead and saves you from tracking separate payments."),
             S("A simple system",
               "Use one bank account or card for gig income and expenses. Download each app's annual tax summary in January. Keep one mileage log covering every platform. Save receipts monthly in one folder or app. Then bring all of it at once, along with your 1099s and any estimated payments you made."),
             S("What we charge",
               "An individual return with one Schedule C starts at $325 for the 1040 plus $275 for the Schedule C. If you drive for several platforms, the fee doesn't change; we reconcile them together.",
               "New drivers often ask us to look at their first quarter before the first estimated payment is due. That short review, included for return clients, sets a percentage to put aside from each payout and catches record-keeping gaps while they are still easy to fix."),
         ]),
]

# ---------------------------------------------------------------------------------------------------------------------
# Reviews (sample; the site labels them as samples)
# ---------------------------------------------------------------------------------------------------------------------
REVIEWS = [
    ("Delphine R.", "Harrow Falls", "individual", 5, "Caught a missed education credit", "Gideon noticed my daughter's 1098-T had been left off the return I did myself last year. They amended it and I got $1,180 back. Organized, clear about fees up front.", "2026-04-02", "st-gor"),
    ("Marcus T.", "Corbel Point", "irs-notices", 5, "CP2000 resolved without paying anything", "I had a notice saying I owed $3,900 on stock I sold. Tomasz pulled the purchase records from my old broker and the IRS dropped the whole thing. Took about ten weeks.", "2026-03-11", "st-tbi"),
    ("Anneliese K.", "Millbrook Crossing", "individual", 4, "Good, but busy in April", "Return was accurate and they explained the changes from last year. Took longer than I expected in early April, though they told me it would. Next year I'll get documents in sooner.", "2026-04-20", "st-ivo"),
    ("Joaquin P.", "Harrow Falls", "payroll", 5, "Took the payroll worry off my plate", "Switched from doing payroll myself. Saoirse set up the deposits, fixed a quarter I'd filed wrong, and now I just approve hours every other Thursday.", "2026-02-17", "st-sdu"),
    ("Wren O.", "Kestrel Bay", "rideshare-gig", 5, "Finally understand my mileage", "I drive for two apps and had no idea the app mileage was missing half my miles. Rafael showed me how to keep a proper log. Much smaller bill than I'd feared.", "2026-03-24", "st-rfe"),
    ("Hollis B.", "Corbel Point", "business", 5, "S corp setup done properly", "Desmond walked me through whether an S election made sense and showed the numbers. Payroll for me started the same month. No surprises at year end.", "2025-12-09", "st-dwh"),
    ("Priyanka S.", "Harrow Falls", "planning", 5, "Worth the planning session", "Mid-year meeting before I exercised options. We timed it across two years and the estimate they gave me was within a few hundred dollars of the actual.", "2026-01-28", "st-pra"),
    ("Ted V.", "Ashby Hollow", "individual", 3, "Accurate but slow to respond", "The return itself was fine. It took several days to get answers to emails during March and I had to call twice. Front desk was friendly once I got through.", "2026-03-30", "st-afw"),
    ("Corinne M.", "Millbrook Crossing", "real-estate", 5, "Fixed years of bad depreciation", "My previous preparer had been depreciating the land on our rental. Hana corrected it with the right form instead of three amended returns and explained why.", "2025-11-14", "st-hna"),
    ("Ifeoma A.", "Harrow Falls", "trusts-estates", 5, "Patient with a difficult year", "Handling my father's estate while grieving was hard. Lindiwe explained the 1041 and what I needed to sign, and never made me feel rushed.", "2026-06-05", "st-lok"),
    ("Brennan F.", "Wrenfield", "bookkeeping", 4, "Clean books every month", "Elspeth's team closes the restaurant books by the 20th like they said. I'd give five stars but the onboarding took a month longer than planned.", "2026-05-19", "st-ebr"),
    ("Siobhan L.", "Corbel Point", "prior-year", 5, "Three unfiled years, sorted", "I was embarrassed to call. They pulled transcripts, filed 2021-2023 and two of them turned out to be refunds. No lecture, just the work.", "2025-10-22", "st-tbi"),
    ("Aurelio G.", "Harrow Falls", "irs-notices", 5, "Penalty removed", "Late-filing penalty on our partnership return was abated under first-time relief. Marisol knew exactly what to ask for.", "2026-07-08", "st-mva"),
    ("Nadia H.", "Millbrook Crossing", "individual", 5, "Evening appointment was a help", "The Tuesday evening hours in March made it possible to meet without taking time off work. Gideon was thorough and quick.", "2026-03-17", "st-gor"),
    ("Collins E.", "Dunmore Flats", "contractors", 4, "Straight talk on 1099s", "Rafael told me two of my guys should be on payroll. Not what I wanted to hear, but he helped me switch them over without a mess.", "2026-01-14", "st-rfe"),
    ("Margit D.", "Harrow Falls", "nonprofit", 5, "Our 990 was painless this year", "Small arts nonprofit. Lindiwe prepared our 990-EZ and a checklist for the board. Fee was what they quoted.", "2026-05-06", "st-lok"),
    ("Rui N.", "Corbel Point", "medical", 5, "Retirement plan set up right", "Dental practice with four staff. They compared a SEP with a 401(k) for us and set up the one that actually fit. Bookkeeping by Kwame is accurate.", "2025-12-18", "st-kmo"),
    ("Esme W.", "Harrow Falls", "individual", 4, "Professional and clear", "Fee was a bit more than my old preparer but the review letter explaining what changed was useful. I'll be back.", "2026-04-09", "st-pra"),
    ("Tobias C.", "Kestrel Bay", "crypto", 5, "Untangled my exchange history", "Four exchanges, one of which shut down. They rebuilt my basis and the 8949 matched the 1099-DA where there was one. Took patience on their end.", "2026-04-13", "st-pra"),
    ("Lucinda J.", "Millbrook Crossing", "state", 5, "Two-state move handled", "Moved here from out of state in July. Both part-year returns were done together and the credit for the other state was applied correctly.", "2025-11-03", "st-gor"),
    ("Femi O.", "Harrow Falls", "payroll", 3, "Fine once it was set up", "Setup took three payrolls to get right and one deposit had to be corrected. Since then it's been smooth and they covered the penalty.", "2026-06-24", "st-sdu"),
    ("Greta S.", "Ashby Hollow", "planning", 5, "No more April surprise", "Self-employed designer. They set my quarterly payments and checked in after the second one. First year I didn't owe a large balance.", "2026-05-27", "st-ivo"),
    ("Dashiell Y.", "Corbel Point", "irs-notices", 4, "Payment plan without the stress", "Owed more than I could pay after a bad year. They set up an online plan with direct debit. Would have been five stars if the first call back had been faster.", "2026-08-12", "st-tbi"),
    ("Imogen P.", "Harrow Falls", "business", 5, "K-1s on time for once", "Our partnership K-1s used to arrive in September. This year they came the day the return was filed in March.", "2026-03-16", "st-dwh"),
    ("Arjun M.", "Wrenfield", "individual", 5, "Explained everything", "First year with RSUs and I didn't understand why my withholding wasn't enough. Priya explained it with my own numbers and fixed the basis on the 1099-B.", "2026-03-05", "st-pra"),
    ("Opal K.", "Millbrook Crossing", "real-estate", 4, "Knows short-term rentals", "Good advice on our cabin rental and personal use days. A little expensive for one property, but it's one less thing to worry about.", "2026-02-26", "st-hna"),
    ("Benedetta F.", "Harrow Falls", "individual", 5, "Portal is easy", "Uploaded everything from my phone. Ada helped me reset access when I got locked out. Return done in a week.", "2026-02-20", "st-afw"),
    ("Malik R.", "Kestrel Bay", "rideshare-gig", 4, "Helpful for a first-time filer", "First year doing deliveries. They explained self-employment tax and set up estimated payments. Wish I'd come in before I spent the money.", "2026-04-07", "st-rfe"),
    ("Ingrid H.", "Corbel Point", "prior-year", 5, "Amended return got me a refund", "Corrected W-2 arrived in May. They filed the 1040-X electronically and the refund came in about nine weeks.", "2025-09-15", "st-tbi"),
    ("Ezra B.", "Harrow Falls", "trusts-estates", 4, "Thorough with the trust", "Trust return and K-1s for three siblings. Communication was good. Took a while to gather date-of-death values, mostly on our side.", "2026-04-30", "st-lok"),
    ("Paloma V.", "Dunmore Flats", "bookkeeping", 5, "Know my numbers now", "Monthly statements with a short note on what changed. I finally know if the shop made money last month.", "2026-08-03", "st-kmo"),
    ("Hamish T.", "Millbrook Crossing", "individual", 3, "OK, communication could be better", "Return was correct. I didn't know my documents were incomplete until they followed up two weeks later. A quicker heads-up would help.", "2026-03-27", "st-ivo"),
    ("Yusra A.", "Harrow Falls", "payroll", 5, "Tip reporting finally right", "Café with eight servers. Tips now go through payroll properly and they claimed the tip credit we'd been missing.", "2026-01-30", "st-sdu"),
    ("Clement G.", "Corbel Point", "business", 4, "Solid work on the 1120-S", "Good review meeting and clear adjusting entries. I'd like more notice before the January document deadline.", "2026-03-12", "st-dwh"),
    ("Rosalind E.", "Ashby Hollow", "irs-notices", 5, "Calm and quick", "Got a letter about a missing estimated payment. They found it on the transcript under the wrong year and had it moved. One phone call from me.", "2026-09-09", "st-mva"),
    ("Keiko N.", "Harrow Falls", "planning", 4, "Useful retirement planning", "Met before my first year of retirement to plan withdrawals and withholding. Practical advice; a follow-up email summary would have helped.", "2026-07-21", "st-pra"),
]

# ---------------------------------------------------------------------------------------------------------------------
# Jobs
# ---------------------------------------------------------------------------------------------------------------------
JOBS = [
    dict(id="job-sta", slug="senior-tax-associate", title="Senior Tax Associate (EA or CPA)", office="harrow", type="Full-time",
         salary="$74,000 - $92,000, depending on credential and experience",
         summary="Prepare and review individual and pass-through returns, lead client meetings, and mentor two preparers. Hybrid after the first season.",
         body=[S("About the role",
                 "You'll prepare complex individual returns and S corporation and partnership returns, review returns prepared by our preparers, and meet clients for planning in the off-season. You report to Priya Raghunathan, Tax Manager."),
               S("What you'll do", "Prepare and review Forms 1040, 1120-S and 1065 with K-1s.", "Respond to IRS notices under power of attorney with our representation team.", "Lead two client planning meetings a week from June to October.", "Train and review the work of two preparers.", kind="list"),
               S("What we're looking for", "An active EA or CPA license.", "At least three years preparing individual and pass-through returns.", "Comfort explaining tax results to clients in plain language.", "Experience with professional tax software; we use a cloud-based package.", kind="list"),
               S("Pay and benefits",
                 "Salary $74,000 to $92,000. Employer-paid health and dental for you, 50% for dependants. 401(k) with a 4% match. 20 days of paid leave plus holidays, taken outside February to mid-April. Continuing-education costs and license fees paid. Hybrid schedule after your first filing season; in the office Monday to Thursday from February through April 15.")],
         open=True, sort=1),
    dict(id="job-bks", slug="bookkeeping-specialist", title="Bookkeeping Specialist", office="corbel", type="Full-time",
         salary="$23 - $29 per hour",
         summary="Close monthly books for 25 to 30 small-business clients in QuickBooks Online and Xero.",
         body=[S("About the role",
                 "You'll join Kwame Mensah-Ortiz's bookkeeping team at our Corbel Point office, closing monthly books for contractors, medical practices and restaurants."),
               S("What you'll do", "Categorize transactions and reconcile bank, card and loan accounts.", "Close each client's month by the 20th and draft the monthly summary.", "Track contractor payments and prepare 1099-NEC filings in January.", "Flag unusual items for the tax team.", kind="list"),
               S("What we're looking for", "Two or more years of full-cycle bookkeeping.", "Strong QuickBooks Online skills; Xero a plus.", "Careful with detail and comfortable asking clients for missing items.", kind="list"),
               S("Pay and benefits",
                 "$23 to $29 an hour depending on experience, with paid overtime in January and February. Health and dental, 401(k) with a 4% match, and 15 days of paid leave plus holidays. Training toward QuickBooks certification paid.")],
         open=True, sort=2),
    dict(id="job-scc", slug="seasonal-client-coordinator", title="Seasonal Client Coordinator (January - April)", office="millbrook", type="Seasonal",
         salary="$21 - $24 per hour",
         summary="Greet clients, schedule appointments, scan documents and keep the portal queue moving during filing season.",
         body=[S("About the role",
                 "A seasonal position from January 5 to April 30, 2027 at our Millbrook Crossing office, working with Ada Fairweather, Client Services Coordinator. Hours are 30 to 40 a week, including Tuesday and Thursday evenings until 7."),
               S("What you'll do", "Welcome clients and answer the phone.", "Book and confirm appointments.", "Scan and index documents into the client portal the same day they arrive.", "Follow up with clients on missing documents.", kind="list"),
               S("What we're looking for", "Front-desk or customer-service experience.", "Careful handling of confidential documents.", "No tax experience needed; we train you in January.", kind="list"),
               S("Pay",
                 "$21 to $24 an hour, paid weekly, with a $500 completion bonus for working through April 30. Returning seasonal staff are offered first choice of hours.")],
         open=True, sort=3),
]

# ---------------------------------------------------------------------------------------------------------------------
# Checklist
# ---------------------------------------------------------------------------------------------------------------------
SITUATIONS = [
    ("basics", "Everyone", "Identity and last year's return; always included.", [
        ("Photo ID for you and your spouse", None, "We verify identity before filing to protect against fraudulent returns."),
        ("Social Security cards or ITIN letters for everyone on the return", None, "Names and numbers must match SSA records exactly or the e-file is rejected."),
        ("Last year's federal and state returns", "1040", "We use it for carryovers, prior-year AGI for e-file signatures, and safe-harbor estimates."),
        ("Forms W-2 from each employer", "W-2", "Wages and withholding; the IRS matches these to your return."),
        ("Interest statements", "1099-INT", "Bank and credit union interest, including small amounts."),
        ("Bank details for a refund or balance due", None, "Direct deposit is the fastest way to receive a refund."),
        ("Records of estimated tax payments", "1040-ES", "Dates and amounts, so payments are credited to the right year."),
        ("Health coverage statement if you bought Marketplace insurance", "1095-A", "Needed to reconcile the premium tax credit on Form 8962."),
    ]),
    ("kids", "Children or dependants", "Children, students or other relatives you support.", [
        ("Dates of birth and SSNs for each dependant", None, "Required for the child tax credit and dependant status."),
        ("Child-care provider names, addresses, tax ID numbers and amounts paid", "2441", "For the child and dependent care credit."),
        ("Dependent care FSA statement (box 10 of your W-2)", "W-2", "Employer-provided care benefits reduce the expenses that count for the credit."),
        ("Form 8332 if you are the noncustodial parent claiming a child", "8332", "The custodial parent's signed release is required."),
        ("Any income your dependants received", "1099-INT", "A child's investment income may need its own return or Form 8615."),
    ]),
    ("self", "Self-employed or own a small business", "Sole proprietors, freelancers and single-member LLCs.", [
        ("Forms 1099-NEC and 1099-K", "1099-NEC", "Payments from clients and platforms; report all income even without a form."),
        ("Profit and loss statement or bookkeeping file", "Schedule C", "Income and expenses by category for the year."),
        ("Vehicle mileage log and date the vehicle was first used for business", None, "Supports the mileage or actual-expense deduction."),
        ("Home office square footage and home expenses", "8829", "Needed if you use part of your home exclusively for business."),
        ("Receipts for equipment, computers and furniture bought", "4562", "Large purchases are depreciated or expensed."),
        ("Health insurance premiums you paid", None, "May qualify for the self-employed health insurance deduction."),
        ("Retirement plan contributions (SEP, SIMPLE, solo 401(k))", "5498", "Deductible contributions reduce income tax."),
    ]),
    ("gig", "Rideshare, delivery or app-based work", "Driving, delivering or tasking through an app.", [
        ("Every 1099-K and 1099-NEC from platforms", "1099-K", "The amounts the IRS will match to your return."),
        ("Each platform's annual tax summary", None, "Shows gross fares, platform fees and app-recorded miles."),
        ("Your own mileage log or tracking-app export", None, "App summaries often miss miles driven between trips."),
        ("Phone bill, tolls, parking and supply receipts", None, "Business share of these costs is deductible."),
    ]),
    ("rental", "Rental property", "Long-term, short-term or vacation rentals.", [
        ("Rent received by month, or the property manager's year-end statement", "Schedule E", "Total rents and management fees."),
        ("Mortgage interest statement for the rental", "1098", "Interest on the rental mortgage is a rental expense."),
        ("Property tax bills and insurance statements", None, "Deductible rental expenses."),
        ("Invoices for repairs and improvements", "4562", "Improvements are depreciated; repairs are deducted."),
        ("Closing statement if bought, sold or refinanced this year", None, "Sets basis and depreciation, or reports the sale."),
        ("Days rented and days of personal use", None, "Personal use changes how expenses are divided."),
    ]),
    ("crypto", "Crypto or other digital assets", "Bought, sold, swapped, earned or staked.", [
        ("Form 1099-DA from each broker or exchange", "1099-DA", "Reports sales of digital assets; basis may be missing for 2025."),
        ("Full transaction history export from each exchange", "8949", "Needed to figure basis and gain on every sale or swap."),
        ("Records of crypto received as pay or rewards", "1099-MISC", "Staking, mining and payments are ordinary income when received."),
        ("Wallet addresses you control", None, "So transfers between your own wallets aren't treated as sales."),
    ]),
    ("retirement", "Retired or taking retirement income", "Pensions, IRAs, 401(k)s and Social Security.", [
        ("Retirement distribution statements", "1099-R", "Pension, IRA and 401(k) distributions, including rollovers."),
        ("Social Security benefit statement", "SSA-1099", "Up to part of your benefits may be taxable."),
        ("IRA contribution and value statements", "5498", "Shows contributions, rollovers and Roth conversions."),
        ("Records of after-tax (nondeductible) IRA contributions", "8606", "Prevents being taxed twice on the same money."),
        ("Required minimum distribution letters", None, "Confirms the RMD was taken in full."),
    ]),
    ("education", "College or school costs", "Tuition, student loans and education savings.", [
        ("Tuition statement from each school", "1098-T", "For the American opportunity and lifetime learning credits."),
        ("Receipts for required books and supplies", None, "Some count toward the American opportunity credit."),
        ("Student loan interest statement", "1098-E", "Interest may be deductible."),
        ("529 plan or Coverdell distribution statements", "1099-Q", "Distributions must be matched to qualified expenses."),
        ("Scholarship and grant amounts", None, "Amounts used for room and board can be taxable."),
    ]),
    ("hsa", "Health savings account", "An HSA through work or on your own.", [
        ("HSA distribution statement", "1099-SA", "Distributions reported on Form 8889."),
        ("HSA contribution statement", "5498-SA", "Shows contributions for the year, including those made by April 15."),
        ("Employer HSA contributions (W-2, box 12, code W)", "W-2", "Counts toward your annual limit."),
        ("Your health plan type and months of coverage", "8889", "Eligibility depends on high-deductible coverage each month."),
    ]),
    ("investments", "Investments and stock compensation", "Brokerage accounts, RSUs, ESPPs and stock options.", [
        ("Consolidated brokerage statement", "1099-B", "Sales, dividends and interest in one document."),
        ("Dividend statements not in a consolidated statement", "1099-DIV", "Qualified dividends are taxed at lower rates."),
        ("RSU, ESPP and stock option supplemental statements", "3922", "Brokers often report basis too low; these correct it."),
        ("Schedules K-1 from partnerships, S corporations and trusts", "K-1", "Pass-through income often arrives late; we can extend."),
        ("Records of foreign accounts if any exceeded $10,000", "FinCEN 114", "Foreign accounts may require an FBAR."),
    ]),
    ("new-home", "Bought or sold a home", "Purchase, sale or refinance of your main home.", [
        ("Closing statements for the purchase, sale or refinance", None, "Shows points, property tax proration and sale proceeds."),
        ("Mortgage interest statement", "1098", "Mortgage interest and points paid."),
        ("Proceeds from real estate transactions", "1099-S", "Reports the sale of a home."),
        ("Records of improvements to a home you sold", None, "Improvements increase basis and reduce gain."),
    ]),
    ("moved", "Moved during the year", "Moved between states or changed address.", [
        ("Moving date and old and new addresses", "8822", "For part-year state returns and to update your IRS address."),
        ("W-2s showing wages for each state", "W-2", "Wages are split between states by where you lived and worked."),
        ("State refunds received this year", "1099-G", "Part of a state refund may be taxable."),
    ]),
    ("marriage", "Married, divorced or widowed", "Changes in marital status during the year.", [
        ("Date of marriage, divorce or death", None, "Determines filing status for the year."),
        ("Divorce or separation agreement", None, "Alimony treatment and who claims the children depend on its terms and date."),
        ("Name change confirmation from the SSA", None, "The name on the return must match SSA records."),
        ("Spouse's documents, if filing jointly for the first time", "W-2", "A joint return combines both spouses' income and deductions."),
    ]),
]

# ---------------------------------------------------------------------------------------------------------------------
# Rates the calculators use
# ---------------------------------------------------------------------------------------------------------------------
RATES = [
    ("mileage-business-2025", "Standard mileage rate, business use", "70 cents per mile", 2025, "The 2025 rate from Publication 463 (2025). The IRS announces each year's rate around the end of the prior year; the 2026 rate is not in our library yet.", "mile"),
    ("mileage-medical-2025", "Standard mileage rate, medical travel", "21 cents per mile", 2025, "For driving to medical care, from Publication 502 (2025).", "med21"),
    ("mileage-charity", "Standard mileage rate, charitable service", "14 cents per mile", 2025, "For driving while volunteering for a charity, from Publication 526 (2025).", "char14"),
    ("se-tax-rate", "Self-employment tax rate", "15.3%", 2025, "12.4% Social Security plus 2.9% Medicare, on net earnings from self-employment.", "se_rate"),
    ("se-ss-rate", "Self-employment tax: Social Security part", "12.4%", 2025, "Applies only up to the Social Security wage base.", "se_rate"),
    ("se-medicare-rate", "Self-employment tax: Medicare part", "2.9%", 2025, "Applies to all net earnings from self-employment.", "se_rate"),
    ("se-factor", "Net earnings factor", "92.35%", 2025, "Net profit is multiplied by 92.35% before self-employment tax is figured.", "se_9235"),
    ("se-threshold", "Self-employment tax threshold", "$400", 2025, "No self-employment tax is due if net earnings are under $400.", "se_400"),
    ("ss-wage-base-2025", "Social Security wage base", "$176,100", 2025, "Maximum combined wages and self-employment income subject to the 12.4% Social Security part for 2025.", "se_base25"),
    ("ss-wage-base-2026", "Social Security wage base", "$184,500", 2026, "For 2026, from Publication 15 (2026). Social Security tax is 6.2% each for employer and employee.", "ss26"),
    ("medicare-rate", "Medicare tax rate (FICA)", "1.45% each; 2.9% total", 2026, "No wage base limit.", "med"),
    ("additional-medicare", "Additional Medicare Tax", "0.9% over $200,000", 2026, "Employers withhold it on an employee's wages over $200,000 in a calendar year.", "addl"),
    ("futa-rate", "FUTA tax rate", "6.0% (up to 5.4% credit)", 2025, "Most employers receive a credit of up to 5.4% for state unemployment tax.", "futa"),
    ("futa-wage-base", "FUTA wage base", "$7,000 per employee", 2025, "FUTA applies to the first $7,000 paid to each employee in a calendar year.", "futa7000"),
    ("home-office-rate", "Home office simplified method", "$5 per square foot, up to 300 sq ft", 2025, "Maximum $1,500 a year under the simplified method.", "ho_simpl"),
    ("std-deduction-2026-single", "Standard deduction, single or married filing separately", "$16,100", 2026, "From Publication 505 (2026).", "std26_single"),
    ("std-deduction-2026-mfj", "Standard deduction, married filing jointly", "$32,200", 2026, "From Publication 505 (2026).", "std26_mfj"),
    ("std-deduction-2026-hoh", "Standard deduction, head of household", "$24,150", 2026, "From Publication 505 (2026).", "std26_hoh"),
    ("std-deduction-2025-single", "Standard deduction, single", "$15,750", 2025, "From Publication 501 (2025).", "std25_single"),
    ("std-deduction-2025-mfj", "Standard deduction, married filing jointly", "$31,500", 2025, "From Publication 501 (2025).", "std25_mfj"),
    ("estimated-tax-threshold", "Estimated tax threshold", "$1,000", 2026, "You generally must pay estimated tax if you expect to owe at least $1,000 after withholding and credits.", "est1000"),
    ("estimated-safe-harbor-high", "Prior-year safe harbor for higher incomes", "110%", 2026, "Applies if 2025 AGI was over $150,000 ($75,000 married filing separately).", "est110"),
    ("section-179-2025", "Section 179 expensing limit", "$2,500,000", 2025, "For tax years beginning in 2025.", "179"),
    ("1099-nec-threshold-2026", "Form 1099-NEC reporting threshold", "$2,000", 2026, "For payments made in tax years beginning after 2025; may be adjusted for inflation starting in 2027.", "nec2000"),
    ("1099-k-threshold-2025", "Form 1099-K reporting threshold", "More than $20,000 and more than 200 transactions", 2025, "Platforms must send a 1099-K only above both thresholds; the income is taxable either way.", "1099k"),
    ("salt-cap-2025", "State and local tax deduction limit", "$40,000 ($20,000 MFS)", 2025, "Reduced for modified AGI above $500,000, but not below $10,000.", "salt"),
    ("sep-limit-2025", "SEP IRA contribution limit", "25% of compensation, up to $70,000", 2025, "For self-employed owners the percentage is figured on net earnings.", "sep"),
]

# ---------------------------------------------------------------------------------------------------------------------
# Deadlines: nominal dates moved past weekends and DC legal holidays (IRC 7503)
# ---------------------------------------------------------------------------------------------------------------------
D = dt.date
HOLIDAYS = {
    D(2026, 1, 1): "New Year's Day", D(2026, 1, 19): "Martin Luther King Jr. Day", D(2026, 2, 16): "Washington's Birthday",
    D(2026, 4, 16): "DC Emancipation Day", D(2026, 5, 25): "Memorial Day", D(2026, 6, 19): "Juneteenth", D(2026, 7, 3): "Independence Day (observed)",
    D(2026, 9, 7): "Labor Day", D(2026, 10, 12): "Columbus Day", D(2026, 11, 11): "Veterans Day", D(2026, 11, 26): "Thanksgiving Day", D(2026, 12, 25): "Christmas Day",
    D(2027, 1, 1): "New Year's Day", D(2027, 1, 18): "Martin Luther King Jr. Day", D(2027, 2, 15): "Washington's Birthday",
    D(2027, 4, 16): "DC Emancipation Day", D(2027, 5, 31): "Memorial Day", D(2027, 6, 18): "Juneteenth (observed)", D(2027, 7, 5): "Independence Day (observed)",
    D(2027, 9, 6): "Labor Day", D(2027, 10, 11): "Columbus Day", D(2027, 11, 11): "Veterans Day", D(2027, 11, 25): "Thanksgiving Day", D(2027, 12, 24): "Christmas Day (observed)",
    D(2027, 12, 31): "New Year's Day (observed)", D(2028, 1, 17): "Martin Luther King Jr. Day",
}


def next_business(d):
    while d.weekday() >= 5 or d in HOLIDAYS:
        d += dt.timedelta(days=1)
    return d


def deadline_templates(y):
    p = y - 1
    est = "1040-ES"
    return [
        (D(y, 1, 15), f"Fourth-quarter {p} estimated tax payment", "individuals", est, f"Final estimated payment for tax year {p}. Not needed if you file your {p} return and pay in full by January 31.", "estdates"),
        (D(y, 1, 31), f"Forms W-2 and W-3 for {p}", "employers", "W-2, W-3", "Give W-2s to employees and file Copy A with Form W-3 at the Social Security Administration.", "w2_2026" if y == 2026 else "w2"),
        (D(y, 1, 31), f"Form 1099-NEC for {p}", "businesses", "1099-NEC", "Due to contractors and to the IRS on the same date.", "nec_due"),
        (D(y, 1, 31), f"Fourth-quarter {p} Form 941", "employers", "941", "Quarterly payroll tax return for October through December.", "941_due"),
        (D(y, 1, 31), f"Form 940 for {p}", "employers", "940", "Annual federal unemployment (FUTA) return. Deposit any fourth-quarter FUTA tax over $500 by this date.", "940_due" if y == 2026 else "940_jan31"),
        (D(y, 1, 31), "Most 1099s and 1098s due to recipients", "everyone", "1099-INT, 1099-DIV, 1099-R, 1099-MISC, 1098", "Banks, brokers, plans and lenders send you these statements. Check them against your records.", "furnish"),
        (D(y, 2, 15), "Forms 1099-B and 1099-DA due to recipients", "everyone", "1099-B, 1099-DA, 1099-S", "Brokers send statements of sales, including digital asset sales. Consolidated statements often arrive on this date.", "furnish_b"),
        (D(y, 3, 15), f"Partnership returns for {p}", "businesses", "1065, Schedule K-1", "Calendar-year partnerships and multi-member LLCs. File Form 7004 by this date for a 6-month extension.", "1065_cal" if y == 2026 else "6072b"),
        (D(y, 3, 15), f"S corporation returns for {p}", "businesses", "1120-S, Schedule K-1", "Calendar-year S corporations. File Form 7004 by this date for a 6-month extension.", "1120s_due" if y == 2026 else "6072b"),
        (D(y, 3, 31), "Electronically filed 1099s and 1098s due to the IRS", "businesses", "1099-MISC, 1099-INT, 1098", "E-filed information returns other than 1099-NEC.", "efile_1099"),
        (D(y, 4, 15), f"Individual returns for {p}", "individuals", "1040, 4868", "File Form 1040, or file Form 4868 for an automatic 6-month extension. An extension doesn't extend the time to pay.", "1040due" if y == 2026 else "4868"),
        (D(y, 4, 15), f"First-quarter {y} estimated tax payment", "individuals", est, f"Covers income from January through March {y}.", "estdates"),
        (D(y, 4, 15), f"C corporation returns for {p}", "businesses", "1120", "Calendar-year C corporations. File Form 7004 by this date for a 6-month extension.", "1120due"),
        (D(y, 4, 15), f"Estate and trust returns for {p}", "everyone", "1041", "Calendar-year estates and trusts. Form 7004 gives an automatic 5½-month extension.", "1041_due" if y == 2026 else "7004_1041"),
        (D(y, 4, 15), f"Foreign bank account report (FBAR) for {p}", "individuals", "FinCEN 114", "Required if your foreign accounts together exceeded $10,000 at any time in the year. Filed with FinCEN, not the IRS; FinCEN sets this date and an automatic extension to October 15, which our IRS library does not cover.", "fbar"),
        (D(y, 4, 30), f"First-quarter {y} Form 941", "employers", "941", "Quarterly payroll tax return for January through March.", "941_due"),
        (D(y, 5, 15), f"Exempt organization returns for {p}", "nonprofits", "990, 990-EZ, 990-N, 990-T", "Calendar-year exempt organizations: the 15th day of the 5th month after year end. Form 8868 requests an extension.", "990due"),
        (D(y, 6, 15), f"Second-quarter {y} estimated tax payment", "individuals", est, f"Covers income from April and May {y}.", "estdates"),
        (D(y, 7, 31), f"Second-quarter {y} Form 941", "employers", "941", "Quarterly payroll tax return for April through June.", "941_due"),
        (D(y, 9, 15), f"Third-quarter {y} estimated tax payment", "individuals", est, f"Covers income from June through August {y}.", "estdates"),
        (D(y, 9, 15), f"Extended partnership and S corporation returns for {p}", "businesses", "1065, 1120-S", "Final date for calendar-year returns extended with Form 7004.", "7004"),
        (D(y, 9, 30), f"Extended estate and trust returns for {p}", "everyone", "1041", "Final date for calendar-year Form 1041 extended with Form 7004.", "7004_1041"),
        (D(y, 10, 15), f"Extended individual returns for {p}", "individuals", "1040", "Final date for returns extended with Form 4868.", "4868"),
        (D(y, 10, 15), f"Extended C corporation returns for {p}", "businesses", "1120", "Final date for calendar-year Form 1120 extended with Form 7004.", "7004"),
        (D(y, 10, 31), f"Third-quarter {y} Form 941", "employers", "941", "Quarterly payroll tax return for July through September.", "941_due"),
    ]


def build_deadlines():
    out = []
    for y in (2026, 2027):
        for i, (nominal, title, who, form, detail, ck) in enumerate(deadline_templates(y)):
            due = next_business(nominal)
            if due != nominal:
                why = "a " + nominal.strftime("%A") if nominal.weekday() >= 5 else HOLIDAYS[nominal]
                detail += f" The usual date, {nominal:%B} {nominal.day}, falls on {why}, so it moves to the next business day."
            slug = re.sub(r"[^a-z0-9]+", "-", f"{form.split(',')[0]} {title}".lower()).strip("-")[:48]
            out.append(dict(id=f"dl-{due.isoformat()}-{slug}", date=due.isoformat(), title=title, who=who, form=form, detail=detail, cite={"key": ck}, sort=i))
    return out


# ---------------------------------------------------------------------------------------------------------------------
# Pages (site search)
# ---------------------------------------------------------------------------------------------------------------------
def build_pages():
    pages = [
        ("/tax", "Brindlewick Tax & Accounting", "Home", "Tax preparation, bookkeeping, payroll and IRS help for individuals and small businesses in Harrow Falls, Corbel Point and Millbrook Crossing.", ["home", "tax preparer", "accountant", "CPA", "enrolled agent"]),
        ("/tax/services", "Services", "Services", "Individual and business returns, bookkeeping, payroll, IRS notices, planning, prior-year returns, state returns, trusts and estates, and nonprofits.", ["services", "prices", "fees"]),
    ]
    for s in SERVICES:
        pages.append((f"/tax/services/{s['slug']}", s["name"], "Services", s["short"], [s["slug"].replace("-", " "), s["from_price"]] + s["forms"][:6]))
    for s in INDUSTRIES:
        pages.append((f"/tax/industries/{s['slug']}", s["name"], "Industries", s["short"], [s["slug"].replace("-", " ")] + [w for w in re.findall(r"\b(?:\d{3,4}(?:-[A-Z]+)?|[A-Z]{3,})\b", s["short"])][:5]))
    pages += [
        ("/tax/about", "About Brindlewick", "About", "Who we are, how we work and what our credentials mean.", ["about", "history", "credentials", "EA", "CPA"]),
        ("/tax/team", "Our team", "About", "Enrolled agents, CPAs, bookkeepers and payroll staff across our three offices.", ["team", "staff", "preparers", "enrolled agent", "CPA"]),
        ("/tax/locations", "Offices and hours", "About", "Addresses, hours, parking and accessibility for Harrow Falls, Corbel Point and Millbrook Crossing.", ["locations", "offices", "hours", "parking", "directions"]),
        ("/tax/careers", "Careers", "About", "Open positions: Senior Tax Associate, Bookkeeping Specialist and Seasonal Client Coordinator.", ["jobs", "careers", "hiring", "seasonal"]),
        ("/tax/careers/apply", "Apply for a job", "About", "Send your resume and answer a few questions for an open position.", ["apply", "job application", "resume"]),
        ("/tax/reviews", "Client reviews", "About", "Sample reviews from individual and business clients.", ["reviews", "testimonials", "ratings"]),
        ("/tax/blog", "Articles", "Articles", "Plain-language articles on estimated tax, mileage, IRS notices, payroll, S corporations and more.", ["blog", "articles", "news"]),
    ]
    for a in ARTICLES:
        pages.append((f"/tax/blog/{a['slug']}", a["title"], "Articles", a["summary"], a["tags"]))
    pages += [
        ("/tax/tools/calendar", "Tax calendar", "Tools", "Federal filing and payment deadlines for 2026 and 2027, adjusted for weekends and holidays.", ["deadlines", "due dates", "calendar", "941", "1040", "estimated tax"]),
        ("/tax/tools/checklist", "Document checklist", "Tools", "A personalized list of the documents to bring, based on your situation.", ["checklist", "documents", "what to bring", "W-2", "1099"]),
        ("/tax/tools/quarterly", "Estimated tax calculator", "Tools", "Work out quarterly estimated payments using the safe-harbor rules.", ["estimated tax", "quarterly", "1040-ES", "safe harbor"]),
        ("/tax/tools/mileage", "Mileage deduction calculator", "Tools", "Figure your vehicle deduction at the standard mileage rate.", ["mileage", "standard mileage rate", "car", "vehicle"]),
        ("/tax/tools/se-tax", "Self-employment tax calculator", "Tools", "Estimate self-employment tax on net profit from a business or gig work.", ["self-employment tax", "Schedule SE", "15.3%", "gig"]),
        ("/tax/tools/refund-status", "Refund status", "Tools", "How to check a federal or state refund, and what to do if it's late.", ["refund", "where's my refund", "status"]),
        ("/tax/pricing", "Pricing", "Services", "Fixed fees for returns, bookkeeping, payroll and notice responses, published in advance.", ["pricing", "fees", "cost", "how much"]),
        ("/tax/guides", "IRS guide library", "Resources", "Search IRS publications, form instructions, FAQs and tax topics, with links to the original source.", ["IRS publications", "guides", "library", "instructions", "Pub 17"]),
        ("/tax/book", "Book an appointment", "Get started", "Choose an office or video call and pick a time with a preparer.", ["book", "appointment", "schedule", "meeting"]),
        ("/tax/start", "Become a client", "Get started", "Start the new-client intake: your situation, the services you need, and a secure upload link.", ["intake", "new client", "get started", "sign up"]),
        ("/tax/notice", "Send us an IRS notice", "Get started", "Upload a letter from the IRS or the state and we'll review it and call you.", ["IRS notice", "letter", "CP2000", "upload"]),
        ("/tax/payroll-setup", "Payroll setup", "Get started", "Set up payroll for a new or existing business: company details, employees and pay schedule.", ["payroll", "setup", "new employer", "employees"]),
        ("/tax/address-change", "Change of address", "Get started", "Update your address with us and get help filing Form 8822 with the IRS.", ["address change", "moved", "8822"]),
        ("/tax/payment-plan", "Payment plan help", "Get started", "Tell us what you owe and what you can pay; we'll set up an IRS payment plan.", ["payment plan", "installment agreement", "9465", "owe"]),
        ("/tax/prior-year", "Prior-year returns", "Get started", "Request help with unfiled or amended returns for earlier years.", ["prior year", "unfiled", "amended", "1040-X"]),
        ("/tax/refer", "Refer a friend", "Get started", "Refer a friend or family member; you both get $50 off your next return.", ["refer", "referral", "friend"]),
        ("/tax/contact", "Contact us", "Get started", "Phone, email and secure message options, and how fast we reply.", ["contact", "phone", "email", "message"]),
        ("/tax/portal", "Client portal", "Clients", "Sign in to upload documents, sign returns, pay invoices and message your preparer.", ["portal", "login", "sign in", "upload"]),
        ("/tax/privacy", "Privacy notice", "Legal", "How we collect, use, protect and share your information.", ["privacy", "data", "security"]),
        ("/tax/terms", "Terms of use", "Legal", "Terms for using this website and the client portal.", ["terms", "legal", "conditions"]),
    ]
    return [dict(path=p, title=t, section=s, summary=sm, keywords=kw, sort=i) for i, (p, t, s, sm, kw) in enumerate(pages)]


# ---------------------------------------------------------------------------------------------------------------------
# Citation resolution and checks
# ---------------------------------------------------------------------------------------------------------------------
MARK = re.compile(r"\[(\d+)\]")


def all_keys():
    keys = set()
    for coll in (SERVICES, INDUSTRIES, ARTICLES):
        for x in coll:
            keys |= {c["key"] for c in x["cites"]}
    keys |= {r[5] for r in RATES}
    for y in (2026, 2027):
        keys |= {t[5] for t in deadline_templates(y)}
    return keys


def resolve(keys):
    ids = sorted({Q[k][0] for k in keys})
    got = {r["id"]: r for r in rows_of(sql("select p.id, p.doc, p.section, p.url, p.text, d.title from irs_passages p join irs_docs d on d.doc = p.doc where p.id = any($1)", [ids]))}
    errors, out = [], {}
    for k in sorted(keys):
        pid, quote = Q[k]
        r = got.get(pid)
        n = len(quote.split())
        if not r:
            errors.append(f"{k}: passage {pid} not found")
            continue
        if quote not in r["text"]:
            errors.append(f"{k}: quote is not an exact substring of {pid}: {quote[:70]!r}")
        if not 8 <= n <= 40:
            errors.append(f"{k}: quote has {n} words (8-40 required)")
        out[k] = {"passage": pid, "doc": r["doc"], "title": r["title"], "section": r["section"], "quote": quote, "url": r["url"]}
    return out, errors


def texts_of(x):
    for sec in x.get("body", []):
        for p in sec["paragraphs"]:
            yield p
    for f in x.get("faqs", []):
        yield f["q"]
        yield f["a"]


def check_markers(kind, x, errors):
    n = len(x["cites"])
    used = set()
    for t in texts_of(x):
        for m in MARK.findall(t):
            i = int(m)
            used.add(i)
            if not 1 <= i <= n:
                errors.append(f"{kind} {x['slug']}: marker [{i}] has no matching cite (has {n})")
    unused = set(range(1, n + 1)) - used
    if unused:
        errors.append(f"{kind} {x['slug']}: cites {sorted(unused)} are never referenced")


def words(x):
    return sum(len(p.split()) for sec in x["body"] for p in sec["paragraphs"])


DDL = """
create table if not exists bw_pages (path text primary key, title text, section text, summary text, keywords text[], sort int);
create table if not exists bw_services (slug text primary key, name text, short text, audience text, from_price text, icon text, sort int, body jsonb, faqs jsonb, forms text[], cites jsonb);
create table if not exists bw_industries (slug text primary key, name text, short text, icon text, sort int, body jsonb, faqs jsonb, cites jsonb);
create table if not exists bw_articles (slug text primary key, title text, summary text, category text, author_id text, published date, minutes int, tags text[], body jsonb, cites jsonb);
create table if not exists bw_reviews (id text primary key, author text, city text, service text, rating int, title text, body text, date date, staff_id text);
create table if not exists bw_jobs (id text primary key, slug text, title text, office text, type text, salary text, summary text, body jsonb, open bool, sort int);
create table if not exists bw_deadlines (id text primary key, date date, title text, who text, form text, detail text, cite jsonb, sort int);
create table if not exists bw_checklist_situations (id text primary key, label text, hint text, sort int);
create table if not exists bw_checklist_items (id text primary key, situation text, name text, form text, why text, sort int);
create table if not exists bw_rates (id text primary key, label text, value text, year int, detail text, cite jsonb, sort int);
"""
TABLES = ["bw_pages", "bw_services", "bw_industries", "bw_articles", "bw_reviews", "bw_jobs", "bw_deadlines", "bw_checklist_situations", "bw_checklist_items", "bw_rates"]


def main():
    cite_map, errors = resolve(all_keys())
    for kind, coll in (("service", SERVICES), ("industry", INDUSTRIES), ("article", ARTICLES)):
        for x in coll:
            check_markers(kind, x, errors)
            if not 1 <= len(x["cites"]) <= (6 if kind == "article" else 4):
                errors.append(f"{kind} {x['slug']}: {len(x['cites'])} cites")
    for a in ARTICLES:
        if len(a["cites"]) < 3:
            errors.append(f"article {a['slug']}: fewer than 3 cites")
        w = words(a)
        if not 600 <= w <= 900:
            errors.append(f"article {a['slug']}: {w} words (600-900)")
    staff = {r["id"] for r in rows_of(sql("select id from bw_staff"))}
    offices = {r["id"] for r in rows_of(sql("select id from bw_locations"))}
    errors += [f"article {a['slug']}: unknown author {a['author_id']}" for a in ARTICLES if a["author_id"] not in staff]
    errors += [f"review {r[0]}: unknown staff {r[7]}" for r in REVIEWS if r[7] not in staff]
    errors += [f"job {j['id']}: unknown office {j['office']}" for j in JOBS if j["office"] not in offices]
    if errors:
        print("CITATION/CONTENT CHECK FAILED:")
        for e in errors:
            print("  -", e)
        sys.exit(1)
    n_cites = sum(len(x["cites"]) for c in (SERVICES, INDUSTRIES, ARTICLES) for x in c) + len(RATES) + 2 * len(deadline_templates(2026))
    print(f"citation check passed: {len(cite_map)} distinct quotes across {len({c['passage'] for c in cite_map.values()})} passages, {n_cites} cite slots; every [n] resolves")
    for a in ARTICLES:
        print(f"  {a['slug']}: {words(a)} words, {len(a['cites'])} cites")

    fill = lambda cs: [cite_map[c["key"]] for c in cs]  # noqa: E731
    services = [dict(slug=s["slug"], name=s["name"], short=s["short"], audience=s["audience"], from_price=s["from_price"], icon=s["icon"], sort=i + 1,
                     body=s["body"], faqs=s["faqs"], forms=s["forms"], cites=fill(s["cites"])) for i, s in enumerate(SERVICES)]
    industries = [dict(slug=s["slug"], name=s["name"], short=s["short"], icon=s["icon"], sort=i + 1, body=s["body"], faqs=s["faqs"], cites=fill(s["cites"]))
                  for i, s in enumerate(INDUSTRIES)]
    articles = [dict(slug=a["slug"], title=a["title"], summary=a["summary"], category=a["category"], author_id=a["author_id"], published=a["published"],
                     minutes=max(3, round(words(a) / 200)), tags=a["tags"], body=a["body"], cites=fill(a["cites"])) for a in ARTICLES]
    reviews = [dict(id=f"rv-{i + 1:02d}", author=r[0], city=r[1], service=r[2], rating=r[3], title=r[4], body=r[5], date=r[6], staff_id=r[7]) for i, r in enumerate(REVIEWS)]
    jobs = [dict(id=j["id"], slug=j["slug"], title=j["title"], office=j["office"], type=j["type"], salary=j["salary"], summary=j["summary"], body=j["body"], open=j["open"], sort=j["sort"]) for j in JOBS]
    deadlines = build_deadlines()
    for d in deadlines:
        d["cite"] = cite_map[d["cite"]["key"]]
    situations = [dict(id=s[0], label=s[1], hint=s[2], sort=i + 1) for i, s in enumerate(SITUATIONS)]
    items = [dict(id=f"{s[0]}-{j + 1:02d}", situation=s[0], name=it[0], form=it[1], why=it[2], sort=j + 1) for s in SITUATIONS for j, it in enumerate(s[3])]
    rates = [dict(id=r[0], label=r[1], value=r[2], year=r[3], detail=r[4], cite=cite_map[r[5]], sort=i + 1) for i, r in enumerate(RATES)]
    data = {"bw_pages": build_pages(), "bw_services": services, "bw_industries": industries, "bw_articles": articles, "bw_reviews": reviews, "bw_jobs": jobs,
            "bw_deadlines": deadlines, "bw_checklist_situations": situations, "bw_checklist_items": items, "bw_rates": rates}

    for stmt in [s for s in DDL.split(";") if s.strip()]:
        sql(stmt)
    for t in TABLES:
        sql(f"truncate {t}")
        insert(t, data[t])
        sql(f"analyze {t}")
        n = rows_of(sql(f"select count(*)::int as n from {t}"))[0]["n"]
        print(f"{t}: {n} rows")


if __name__ == "__main__":
    main()
