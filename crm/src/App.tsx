import { CRM, type CRMProps } from "@/components/atomic-crm/root/CRM";
import {
  authProvider as demoAuthProvider,
  dataProvider as demoDataProvider,
} from "@/components/atomic-crm/providers/fakerest";

/**
 * Application entry point
 *
 * Customize Atomic CRM by passing props to the CRM component:
 *  - contactGender
 *  - companySectors
 *  - darkTheme
 *  - dealCategories
 *  - dealPipelineStatuses
 *  - dealStages
 *  - lightTheme
 *  - logo
 *  - noteStatuses
 *  - taskTypes
 *  - title
 * ... as well as all the props accepted by shadcn-admin-kit's <Admin> component.
 *
 * @example
 * const App = () => (
 *    <CRM
 *       logo="./img/logo.png"
 *       title="Acme CRM"
 *    />
 * );
 */
const dataSource =
  (import.meta.env.VITE_CRM_DATA_SOURCE ??
    import.meta.env.VITE_IS_DEMO ??
    "false") as string;

const normalizedDataSource = dataSource.trim().toLowerCase();
const isDemo =
  normalizedDataSource === "true" ||
  normalizedDataSource === "1" ||
  normalizedDataSource === "demo";

const crmProps: CRMProps = {
  title: "deckd CRM",
  disableTelemetry: true,
  ...(isDemo
    ? {
        dataProvider: demoDataProvider,
        authProvider: demoAuthProvider,
      }
    : {}),
};

const App = () => <CRM {...crmProps} />;

export default App;
