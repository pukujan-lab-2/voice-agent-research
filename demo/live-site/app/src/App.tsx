import { BrowserRouter, Routes, Route } from "react-router-dom";
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

const App = () => (
  <BrowserRouter>
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

      {/* Sent confirmation */}
      <Route path="/sent" element={<Sent />} />
    </Routes>
  </BrowserRouter>
);

export default App;
