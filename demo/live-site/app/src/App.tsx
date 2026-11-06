import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
// The home page stays in the main bundle so `/` paints at once; every other page loads when it is visited.
import MaybeHome from "./pages/MaybeHome";
const Index = lazy(() => import("./pages/Index"));
const VoiceLab = lazy(() => import("./pages/VoiceLab"));
const Sent = lazy(() => import("./pages/Sent"));

// Clinic
const ClinicHome = lazy(() => import("./pages/clinic/Home"));
const ClinicDoctors = lazy(() => import("./pages/clinic/Doctors"));
const ClinicHelp = lazy(() => import("./pages/clinic/Help"));
const ClinicBook = lazy(() => import("./pages/clinic/Book"));

// Appliance
const ApplianceHome = lazy(() => import("./pages/appliance/Home"));
const ApplianceManuals = lazy(() => import("./pages/appliance/Manuals"));
const ApplianceHelp = lazy(() => import("./pages/appliance/Help"));
const ApplianceSupport = lazy(() => import("./pages/appliance/Support"));

// Pricing
const PricingPlans = lazy(() => import("./pages/pricing/Plans"));
const PricingFaq = lazy(() => import("./pages/pricing/Faq"));
const PricingQuote = lazy(() => import("./pages/pricing/Quote"));

// IT Desk
const ItdeskHome = lazy(() => import("./pages/itdesk/Home"));
const ItdeskKb = lazy(() => import("./pages/itdesk/Kb"));
const ItdeskNew = lazy(() => import("./pages/itdesk/New"));


// Pension
const PensionHome = lazy(() => import("./pages/pension/Home"));
const PensionForms = lazy(() => import("./pages/pension/Forms"));
const PensionHelp = lazy(() => import("./pages/pension/Help"));
const PensionR17 = lazy(() => import("./pages/pension/R17"));

// Brindlewick Tax & Accounting (fictional firm)
const TaxHome = lazy(() => import("./pages/tax/Home"));
const TaxServices = lazy(() => import("./pages/tax/Services"));
const TaxServiceDetail = lazy(() => import("./pages/tax/ServiceDetail"));
const TaxIndustries = lazy(() => import("./pages/tax/Industries"));
const TaxIndustryDetail = lazy(() => import("./pages/tax/IndustryDetail"));
const TaxPricing = lazy(() => import("./pages/tax/Pricing"));
const TaxTeam = lazy(() => import("./pages/tax/Team"));
const TaxLocations = lazy(() => import("./pages/tax/Locations"));
const TaxCareers = lazy(() => import("./pages/tax/Careers"));
const TaxCareerDetail = lazy(() => import("./pages/tax/CareerDetail"));
const TaxApply = lazy(() => import("./pages/tax/Apply"));
const TaxReviews = lazy(() => import("./pages/tax/Reviews"));
const TaxBlog = lazy(() => import("./pages/tax/Blog"));
const TaxBlogPost = lazy(() => import("./pages/tax/BlogPost"));
const TaxAbout = lazy(() => import("./pages/tax/About"));
const TaxContact = lazy(() => import("./pages/tax/Contact"));
const TaxPrivacy = lazy(() => import("./pages/tax/Privacy"));
const TaxTerms = lazy(() => import("./pages/tax/Terms"));
const TaxGuides = lazy(() => import("./pages/tax/Guides"));
const TaxGuidePage = lazy(() => import("./pages/tax/Guide"));
const TaxFaq = lazy(() => import("./pages/tax/Faq"));
const TaxBook = lazy(() => import("./pages/tax/Book"));
const TaxStart = lazy(() => import("./pages/tax/Start"));
const TaxSchedule = lazy(() => import("./pages/tax/Schedule"));
const TaxNoticePage = lazy(() => import("./pages/tax/Notice"));
const TaxPayrollSetup = lazy(() => import("./pages/tax/PayrollSetup"));
const TaxAddressChange = lazy(() => import("./pages/tax/AddressChange"));
const TaxPaymentPlan = lazy(() => import("./pages/tax/PaymentPlan"));
const TaxPriorYear = lazy(() => import("./pages/tax/PriorYear"));
const TaxRefer = lazy(() => import("./pages/tax/Refer"));
const TaxToolsCalendar = lazy(() => import("./pages/tax/ToolsCalendar"));
const TaxToolsChecklist = lazy(() => import("./pages/tax/ToolsChecklist"));
const TaxToolsQuarterly = lazy(() => import("./pages/tax/ToolsQuarterly"));
const TaxToolsMileage = lazy(() => import("./pages/tax/ToolsMileage"));
const TaxToolsSeTax = lazy(() => import("./pages/tax/ToolsSeTax"));
const TaxToolsRefundStatus = lazy(() => import("./pages/tax/ToolsRefundStatus"));

// Brindlewick's practice app (/staff) and client portal (/tax/portal)
const StaffLogin = lazy(() => import("./pages/staff/Login"));
const StaffDashboard = lazy(() => import("./pages/staff/Dashboard"));
const StaffClients = lazy(() => import("./pages/staff/Clients"));
const StaffClientDetail = lazy(() => import("./pages/staff/ClientDetail"));
const StaffPipeline = lazy(() => import("./pages/staff/Pipeline"));
const StaffEngagements = lazy(() => import("./pages/staff/Engagements"));
const NewEngagement = lazy(() => import("./pages/staff/NewEngagement"));
const StaffQueue = lazy(() => import("./pages/staff/Queue"));
const StaffDocuments = lazy(() => import("./pages/staff/Documents"));
const StaffNotices = lazy(() => import("./pages/staff/Notices"));
const StaffCalendar = lazy(() => import("./pages/staff/Calendar"));
const StaffBilling = lazy(() => import("./pages/staff/Billing"));
const StaffMessages = lazy(() => import("./pages/staff/Messages"));
const StaffTasks = lazy(() => import("./pages/staff/Tasks"));
const StaffReports = lazy(() => import("./pages/staff/Reports"));
const StaffSubmissions = lazy(() => import("./pages/staff/Submissions"));
const StaffAudit = lazy(() => import("./pages/staff/Audit"));
const PortalLogin = lazy(() => import("./pages/portal/Login"));
const PortalHome = lazy(() => import("./pages/portal/Home"));
const PortalDocuments = lazy(() => import("./pages/portal/Documents"));
const PortalInvoices = lazy(() => import("./pages/portal/Invoices"));
const PortalMessages = lazy(() => import("./pages/portal/Messages"));
const PortalAppointments = lazy(() => import("./pages/portal/Appointments"));
const PortalOrganizer = lazy(() => import("./pages/portal/Organizer"));

/**
 * Registers the app's client-side navigate with the copilot, once, inside the router.
 * The copilot moves between pages with this, so the call is never cut by a page reload.
 */
function CopilotNavigation({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    const register = () => {
      unsubscribe = window.copilot?.onNavigate((path: string) => navigate(path));
    };
    if (window.copilot) register();
    else window.addEventListener("copilot:ready", register, { once: true });
    return () => {
      window.removeEventListener("copilot:ready", register);
      unsubscribe?.();
    };
  }, [navigate]);

  return <>{children}</>;
}

const App = () => (
  <BrowserRouter>
    <CopilotNavigation>
      <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<MaybeHome />} />
        {/* the earlier home page, kept for developers only */}
        <Route path="/dev/index" element={<Index />} />
        <Route path="/voice-lab" element={<VoiceLab />} />

        {/* Clinic */}
        <Route path="/clinic" element={<ClinicHome />} />
        <Route path="/clinic/doctors" element={<ClinicDoctors />} />
        <Route path="/clinic/help" element={<ClinicHelp />} />
        <Route path="/clinic/book" element={<ClinicBook />} />

        {/* Appliance */}
        <Route path="/appliance" element={<ApplianceHome />} />
        <Route path="/appliance/manuals" element={<ApplianceManuals />} />
        <Route path="/appliance/help" element={<ApplianceHelp />} />
        <Route path="/appliance/support" element={<ApplianceSupport />} />

        {/* Pricing */}
        <Route path="/pricing" element={<PricingPlans />} />
        <Route path="/pricing/faq" element={<PricingFaq />} />
        <Route path="/pricing/quote" element={<PricingQuote />} />

        {/* IT Desk */}
        <Route path="/itdesk" element={<ItdeskHome />} />
        <Route path="/itdesk/kb" element={<ItdeskKb />} />
        <Route path="/itdesk/new" element={<ItdeskNew />} />

        {/* Pension */}
        <Route path="/pension" element={<PensionHome />} />
        <Route path="/pension/forms" element={<PensionForms />} />
        <Route path="/pension/help" element={<PensionHelp />} />
        <Route path="/pension/forms/r17" element={<PensionR17 />} />

        {/* Brindlewick Tax & Accounting */}
        <Route path="/tax" element={<TaxHome />} />
        <Route path="/tax/services" element={<TaxServices />} />
        <Route path="/tax/services/:slug" element={<TaxServiceDetail />} />
        <Route path="/tax/industries" element={<TaxIndustries />} />
        <Route path="/tax/industries/:slug" element={<TaxIndustryDetail />} />
        <Route path="/tax/pricing" element={<TaxPricing />} />
        <Route path="/tax/team" element={<TaxTeam />} />
        <Route path="/tax/locations" element={<TaxLocations />} />
        <Route path="/tax/careers" element={<TaxCareers />} />
        <Route path="/tax/careers/apply" element={<TaxApply />} />
        <Route path="/tax/careers/:slug" element={<TaxCareerDetail />} />
        <Route path="/tax/reviews" element={<TaxReviews />} />
        <Route path="/tax/blog" element={<TaxBlog />} />
        <Route path="/tax/blog/:slug" element={<TaxBlogPost />} />
        <Route path="/tax/about" element={<TaxAbout />} />
        <Route path="/tax/contact" element={<TaxContact />} />
        <Route path="/tax/privacy" element={<TaxPrivacy />} />
        <Route path="/tax/terms" element={<TaxTerms />} />
        <Route path="/tax/guides" element={<TaxGuides />} />
        <Route path="/tax/guides/:id" element={<TaxGuidePage />} />
        <Route path="/tax/faq" element={<TaxFaq />} />

        {/* The tools */}
        <Route path="/tax/tools/calendar" element={<TaxToolsCalendar />} />
        <Route path="/tax/tools/checklist" element={<TaxToolsChecklist />} />
        <Route path="/tax/tools/quarterly" element={<TaxToolsQuarterly />} />
        <Route path="/tax/tools/mileage" element={<TaxToolsMileage />} />
        <Route path="/tax/tools/se-tax" element={<TaxToolsSeTax />} />
        <Route path="/tax/tools/refund-status" element={<TaxToolsRefundStatus />} />

        {/* The forms */}
        <Route path="/tax/book" element={<TaxBook />} />
        <Route path="/tax/start" element={<TaxStart />} />
        <Route path="/tax/schedule" element={<TaxSchedule />} />
        <Route path="/tax/notice" element={<TaxNoticePage />} />
        <Route path="/tax/payroll-setup" element={<TaxPayrollSetup />} />
        <Route path="/tax/address-change" element={<TaxAddressChange />} />
        <Route path="/tax/payment-plan" element={<TaxPaymentPlan />} />
        <Route path="/tax/prior-year" element={<TaxPriorYear />} />
        <Route path="/tax/refer" element={<TaxRefer />} />

        {/* Brindlewick practice app */}
        <Route path="/staff" element={<StaffLogin />} />
        <Route path="/staff/dashboard" element={<StaffDashboard />} />
        <Route path="/staff/clients" element={<StaffClients />} />
        <Route path="/staff/clients/:id" element={<StaffClientDetail />} />
        <Route path="/staff/pipeline" element={<StaffPipeline />} />
        <Route path="/staff/engagements" element={<StaffEngagements />} />
        <Route path="/staff/engagements/new" element={<NewEngagement />} />
        <Route path="/staff/queue" element={<StaffQueue />} />
        <Route path="/staff/documents" element={<StaffDocuments />} />
        <Route path="/staff/notices" element={<StaffNotices />} />
        <Route path="/staff/calendar" element={<StaffCalendar />} />
        <Route path="/staff/billing" element={<StaffBilling />} />
        <Route path="/staff/messages" element={<StaffMessages />} />
        <Route path="/staff/tasks" element={<StaffTasks />} />
        <Route path="/staff/reports" element={<StaffReports />} />
        <Route path="/staff/submissions" element={<StaffSubmissions />} />
        <Route path="/staff/audit" element={<StaffAudit />} />

        {/* Brindlewick client portal */}
        <Route path="/tax/portal" element={<PortalLogin />} />
        <Route path="/tax/portal/home" element={<PortalHome />} />
        <Route path="/tax/portal/documents" element={<PortalDocuments />} />
        <Route path="/tax/portal/invoices" element={<PortalInvoices />} />
        <Route path="/tax/portal/messages" element={<PortalMessages />} />
        <Route path="/tax/portal/appointments" element={<PortalAppointments />} />
        <Route path="/tax/portal/organizer" element={<PortalOrganizer />} />

        {/* Sent confirmation */}
        <Route path="/sent" element={<Sent />} />
      </Routes>
      </Suspense>
    </CopilotNavigation>
  </BrowserRouter>
);

export default App;
