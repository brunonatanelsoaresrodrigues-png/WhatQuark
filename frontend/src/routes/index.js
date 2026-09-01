import React, { lazy, Suspense } from "react";
import { CircularProgress } from "@material-ui/core";
import { BrowserRouter, Switch } from "react-router-dom";
import { ToastContainer } from "react-toastify";

import LoggedInLayout from "../layout";
const Dashboard = lazy(() => import("../pages/Dashboard/"));
const Tickets = lazy(() => import("../pages/Tickets/"));
const Signup = lazy(() => import("../pages/Signup/"));
const Login = lazy(() => import("../pages/Login/"));
const Connections = lazy(() => import("../pages/Connections/"));
const Settings = lazy(() => import("../pages/Settings/"));
const Users = lazy(() => import("../pages/Users"));
const Contacts = lazy(() => import("../pages/Contacts/"));
const QuickAnswers = lazy(() => import("../pages/QuickAnswers/"));
const Queues = lazy(() => import("../pages/Queues/"));
const QuarkDashboard = lazy(() => import("../pages/QuarkDashboard/"));
const QuarkClinic = lazy(() => import("../pages/QuarkClinic/"));
const DailyReports = lazy(() => import("../pages/DailyReports/"));
const ServiceRatings = lazy(() => import("../pages/ServiceRatings/"));
import { AuthProvider } from "../context/Auth/AuthContext";
import { WhatsAppsProvider } from "../context/WhatsApp/WhatsAppsContext";
import { ThemeProvider } from "../context/DarkMode";
import Route from "./Route";

const Routes = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <Suspense
            fallback={
              <div role="status" style={{ padding: 32 }}>
                <CircularProgress aria-label="Carregando página" />
              </div>
            }
          >
            <Switch>
              <Route exact path="/login" component={Login} />
              <Route exact path="/signup" component={Signup} />
              <WhatsAppsProvider>
                <LoggedInLayout>
                  <Route exact path="/" component={Dashboard} isPrivate />
                  <Route
                    exact
                    path="/tickets/:ticketId?"
                    component={Tickets}
                    isPrivate
                  />
                  <Route
                    exact
                    path="/connections"
                    component={Connections}
                    isPrivate
                  />
                  <Route
                    exact
                    path="/contacts"
                    component={Contacts}
                    isPrivate
                  />
                  <Route exact path="/users" component={Users} isPrivate />
                  <Route
                    exact
                    path="/quickAnswers"
                    component={QuickAnswers}
                    isPrivate
                  />
                  <Route
                    exact
                    path="/Settings"
                    component={Settings}
                    isPrivate
                  />
                  <Route exact path="/Queues" component={Queues} isPrivate />
                  <Route
                    exact
                    path="/quark-dashboard"
                    component={QuarkDashboard}
                    isPrivate
                  />
                  <Route
                    exact
                    path="/quark-clinic"
                    component={QuarkClinic}
                    isPrivate
                  />
                  <Route
                    exact
                    path="/daily-reports"
                    component={DailyReports}
                    isPrivate
                  />
                  <Route
                    exact
                    path="/service-ratings"
                    component={ServiceRatings}
                    isPrivate
                  />
                </LoggedInLayout>
              </WhatsAppsProvider>
            </Switch>
          </Suspense>
          <ToastContainer autoClose={3000} />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default Routes;
