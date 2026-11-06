type PaddleInstance = {
  Environment: { set: (environment: "sandbox") => void };
  Initialize: (options: { token: string }) => void;
  Checkout: {
    open: (options: {
      transactionId: string;
      customer: { email: string };
      settings: { successUrl: string };
    }) => void;
  };
};

declare global {
  interface Window {
    Paddle?: PaddleInstance;
    paddleScriptPromise?: Promise<PaddleInstance>;
  }
}

let initialized = false;

function loadPaddleScript() {
  if (window.Paddle) return Promise.resolve(window.Paddle);
  if (window.paddleScriptPromise) return window.paddleScriptPromise;

  window.paddleScriptPromise = new Promise<PaddleInstance>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.async = true;
    script.onload = () => {
      if (window.Paddle) resolve(window.Paddle);
      else reject(new Error("PADDLE_SCRIPT_UNAVAILABLE"));
    };
    script.onerror = () => {
      window.paddleScriptPromise = undefined;
      reject(new Error("PADDLE_SCRIPT_LOAD_FAILED"));
    };
    document.head.appendChild(script);
  });
  return window.paddleScriptPromise;
}

export async function openPaddleCheckout(
  transactionId: string,
  customerEmail: string,
  successUrl: string,
) {
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  if (!token) throw new Error("PADDLE_CLIENT_NOT_CONFIGURED");

  const paddle = await loadPaddleScript();
  if (!initialized) {
    if ((process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT ?? "sandbox") === "sandbox") {
      paddle.Environment.set("sandbox");
    }
    paddle.Initialize({ token });
    initialized = true;
  }
  paddle.Checkout.open({
    transactionId,
    customer: { email: customerEmail },
    settings: { successUrl },
  });
}
