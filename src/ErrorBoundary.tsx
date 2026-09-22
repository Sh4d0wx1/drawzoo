import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMsg: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMsg: ""
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMsg: error.toString() };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "40px", color: "white", fontFamily: "sans-serif", background: "#0a1520", height: "100vh" }}>
          <h1 style={{ color: "#ff6b6b" }}>Hardware Acceleration Crashed!</h1>
          <p>Your browser's 3D Graphics engine (WebGL) has failed to initialize.</p>
          <div style={{ background: "rgba(255,0,0,0.1)", padding: "20px", borderRadius: "8px", border: "1px solid #ff6b6b", margin: "20px 0" }}>
            <code>{this.state.errorMsg}</code>
          </div>
          <h3>How to fix this:</h3>
          <p>This happens on Linux when the graphics driver gets overloaded.</p>
          <ol style={{ lineHeight: "1.8" }}>
            <li>Close <strong>every single Chrome window</strong>.</li>
            <li>Make sure Chrome isn't running in the background (run <code>killall chrome</code> in your terminal).</li>
            <li>If it STILL happens after reopening Chrome, you need to <strong>restart your computer</strong> to reset the graphics driver.</li>
          </ol>
        </div>
      );
    }

    return this.props.children;
  }
}
