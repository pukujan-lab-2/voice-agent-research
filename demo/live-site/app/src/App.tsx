import { useEffect, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import Index from "./pages/Index";
import Sent from "./pages/Sent";

// Clinic
import ClinicHome from "./pages/clinic/Home";
import ClinicDoctors from "./pages/clinic/Doctors";
import ClinicHelp from "./pages/clinic/Help";
import ClinicBook from "./pages/clinic/Book";

// Appliance
import ApplianceHome from "./pages/appliance/Home";
import ApplianceManuals from "./pages/appliance/Manuals";
import ApplianceHelp from "./pages/appliance/Help";
import ApplianceSupport from "./pages/appliance/Support";

// Pricing
import PricingPlans from "./pages/pricing/Plans";
import PricingFaq from "./pages/pricing/Faq";
import PricingQuote from "./pages/pricing/Quote";

// IT Desk
import ItdeskHome from "./pages/itdesk/Home";
import ItdeskKb from "./pages/itdesk/Kb";
import ItdeskNew from "./pages/itdesk/New";


// Pension
import PensionHome from "./pages/pension/Home";
import PensionForms from "./pages/pension/Forms";
import PensionHelp from "./pages/pension/Help";
import PensionR17 from "./pages/pension/R17";

// Brindlewick Tax & Accounting (fictional firm)
import TaxHome from "./pages/tax/Home";
import TaxServices from "./pages/tax/Services";
import TaxServiceDetail from "./pages/tax/ServiceDetail";
import TaxPricing from "./pages/tax/Pricing";
import TaxTeam from "./pages/tax/Team";
import TaxAbout from "./pages/tax/About";
import TaxGuides from "./pages/tax/Guides";
import TaxGuidePage from "./pages/tax/Guide";
import TaxFaq from "./pages/tax/Faq";
import TaxBook from "./pages/tax/Book";

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
      <Routes>
        <Route path="/" element={<Index />} />

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
        <Route path="/tax/pricing" element={<TaxPricing />} />
        <Route path="/tax/team" element={<TaxTeam />} />
        <Route path="/tax/about" element={<TaxAbout />} />
        <Route path="/tax/guides" element={<TaxGuides />} />
        <Route path="/tax/guides/:id" element={<TaxGuidePage />} />
        <Route path="/tax/faq" element={<TaxFaq />} />
        <Route path="/tax/book" element={<TaxBook />} />

        {/* Sent confirmation */}
        <Route path="/sent" element={<Sent />} />
      </Routes>
    </CopilotNavigation>
  </BrowserRouter>
);

export default App;
