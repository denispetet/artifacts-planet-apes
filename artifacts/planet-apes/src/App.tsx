import { Switch, Route, Router as WouterRouter } from "wouter";
import { ToastProvider } from "@/hooks/useToast";
import Home from "@/pages/Home";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="*" component={Home} />
    </Switch>
  );
}

function App() {
  return (
    <ToastProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
    </ToastProvider>
  );
}

export default App;
