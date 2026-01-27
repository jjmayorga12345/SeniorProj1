import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { verifyResetCode, resetPassword } from "../../api";

function EyeIcon({ show, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#62748e] hover:text-[#314158] focus:outline-none"
      tabIndex={-1}
      aria-label={show ? "Hide password" : "Show password"}
    >
      {show ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}

function ResetPasswordPage() {
  const location = useLocation();
  const [step, setStep] = useState("verify"); // "verify" | "reset"
  const [formData, setFormData] = useState({
    email: location.state?.email || "",
    code: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [verifySuccess, setVerifySuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Prefill email from location state if available
    if (location.state?.email) {
      setFormData((prev) => ({ ...prev, email: location.state.email }));
    }
  }, [location.state]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Only allow digits for code field
    if (name === "code") {
      const digitsOnly = value.replace(/\D/g, "");
      if (digitsOnly.length <= 6) {
        setFormData((prev) => ({ ...prev, [name]: digitsOnly }));
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    setError("");
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError("");
    setVerifySuccess(false);

    // Client-side validation
    if (!/^\d{6}$/.test(formData.code)) {
      setError("Code must be exactly 6 digits.");
      return;
    }

    setLoading(true);

    try {
      await verifyResetCode({
        email: formData.email,
        code: formData.code,
      });
      setVerifySuccess(true);
      setStep("reset");
    } catch (err) {
      const errorMessage = err.message || "Invalid or expired code.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");

    // Client-side validation
    if (formData.newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await resetPassword({
        email: formData.email,
        code: formData.code,
        newPassword: formData.newPassword,
      });
      navigate("/login", { state: { resetSuccess: true }, replace: true });
    } catch (err) {
      const errorMessage = err.message || "Password reset failed. Please try again.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const inputBase = "h-[50px] w-full rounded-lg border border-[#cad5e2] pl-10 pr-12 text-base placeholder:text-[rgba(10,10,10,0.5)] focus:outline-none focus:ring-2 focus:ring-[#2e6b4e] focus:border-transparent";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-5 font-[Arimo,sans-serif]">
      <div className="w-full max-w-[480px] bg-white border border-[#e2e8f0] rounded-2xl shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)] p-8 flex flex-col gap-6">
        {/* Brand row: logo */}
        <div className="flex items-center justify-center">
          <img 
            src="/eventure-logo.png" 
            alt="Eventure" 
            className="h-14 w-auto"
          />
        </div>

        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-2xl text-[#0f172b] font-semibold">Reset Password</h1>
          <p className="text-base text-[#45556c]">Enter the code and choose a new password</p>
        </div>

        {verifySuccess && step === "reset" && (
          <div className="bg-green-50 text-[#2e6b4e] p-3 rounded-lg text-center text-sm" role="status">
            Code verified. Please enter your new password.
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-center text-sm" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={step === "verify" ? handleVerifyCode : handleResetPassword} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm text-[#314158]">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="you@example.com"
              className={inputBase}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="code" className="text-sm text-[#314158]">
              Verification Code
            </label>
            <input
              type="text"
              id="code"
              name="code"
              value={formData.code}
              onChange={handleChange}
              required
              maxLength={6}
              placeholder="Enter 6-digit code"
              readOnly={step === "reset"}
              className={`${inputBase} text-center tracking-widest text-lg font-mono ${step === "reset" ? "bg-gray-50 cursor-not-allowed" : ""}`}
            />
          </div>

          {step === "verify" ? (
            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full bg-[#2e6b4e] text-white rounded-lg font-medium hover:bg-[#255a43] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Verifying..." : "Verify Code"}
            </button>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="newPassword" className="text-sm text-[#314158]">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="newPassword"
                    name="newPassword"
                    value={formData.newPassword}
                    onChange={handleChange}
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
                    className={inputBase}
                  />
                  <EyeIcon show={showPassword} onClick={() => setShowPassword((s) => !s)} />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirmPassword" className="text-sm text-[#314158]">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    minLength={8}
                    placeholder="Confirm your password"
                    className={inputBase}
                  />
                  <EyeIcon show={showConfirmPassword} onClick={() => setShowConfirmPassword((s) => !s)} />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="h-12 w-full bg-[#2e6b4e] text-white rounded-lg font-medium hover:bg-[#255a43] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </>
          )}
        </form>

        <div className="flex flex-col gap-2">
          <p className="text-sm text-[#62748e] text-center">
            <Link
              to="/forgot-password"
              state={{ email: formData.email }}
              className="text-[#2e6b4e] hover:underline font-medium"
            >
              Resend code
            </Link>
          </p>
          <p className="text-sm text-[#62748e] text-center">
            <Link to="/login" className="text-[#2e6b4e] hover:underline font-medium">
              Back to Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordPage;
