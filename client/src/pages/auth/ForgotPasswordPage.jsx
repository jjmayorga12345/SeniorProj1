import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { forgotPassword } from "../../api";

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    try {
      await forgotPassword(email);
      setSuccess(true);
      // Automatically navigate to reset-password after short delay
      setTimeout(() => {
        navigate("/reset-password", { state: { email: email.trim().toLowerCase() } });
      }, 1000);
    } catch (err) {
      setError(err.message || "Failed to send verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="text-2xl text-[#0f172b] font-semibold">Forgot Password</h1>
          <p className="text-base text-[#45556c]">We will send you a verification code</p>
        </div>

        {success && (
          <div className="bg-green-50 text-[#2e6b4e] p-3 rounded-lg text-center text-sm" role="status">
            If that email exists, a verification code was sent.
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-center text-sm" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm text-[#314158]">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="h-[50px] w-full rounded-lg border border-[#cad5e2] pl-10 pr-4 text-base placeholder:text-[rgba(10,10,10,0.5)] focus:outline-none focus:ring-2 focus:ring-[#2e6b4e] focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="h-12 w-full bg-[#2e6b4e] text-white rounded-lg font-medium hover:bg-[#255a43] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Sending..." : "Send Code"}
          </button>
        </form>


        <p className="text-sm text-[#62748e] text-center">
          Remember your password?{" "}
          <Link to="/login" className="text-[#2e6b4e] hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
