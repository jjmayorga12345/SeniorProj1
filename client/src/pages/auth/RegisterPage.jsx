import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../../api";

const ROLE_OPTIONS = [
  { value: "user", label: "Join as attendee" },
  { value: "organizer", label: "Create & manage events" },
];

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

function RegisterPage() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "user",
    password: "",
    confirmPassword: "",
  });
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!agreeTerms) {
      setError("You must agree to the Terms of Service and Privacy Policy.");
      return;
    }

    setLoading(true);

    try {
      await register({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: formData.role,
      });
      navigate("/login", { state: { registered: true }, replace: true });
    } catch (err) {
      const msg = err.message || "Registration failed. Please try again.";
      setError(msg === "Email already in use" ? "Email already in use." : msg);
    } finally {
      setLoading(false);
    }
  };

  const inputBase =
    "h-[50px] w-full rounded-lg border border-[#cad5e2] pl-10 pr-12 text-base placeholder:text-[rgba(10,10,10,0.5)] focus:outline-none focus:ring-2 focus:ring-[#2e6b4e] focus:border-transparent";

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
          <h1 className="text-2xl text-[#0f172b] font-semibold">Create Account</h1>
          <p className="text-base text-[#45556c]">Join the community today</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-center text-sm" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="firstName" className="text-sm text-[#314158]">
                First Name
              </label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
                placeholder="First name"
                className={inputBase}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="lastName" className="text-sm text-[#314158]">
                Last Name
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
                placeholder="Last name"
                className={inputBase}
              />
            </div>
          </div>

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
            <label htmlFor="role" className="text-sm text-[#314158]">
              I want to
            </label>
            <div className="relative">
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                className={`${inputBase} appearance-none bg-white cursor-pointer pr-10`}
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#62748e]">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm text-[#314158]">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={formData.password}
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

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => {
                setAgreeTerms(e.target.checked);
                setError("");
              }}
              className="mt-1 w-4 h-4 text-[#2e6b4e] border-[#cad5e2] rounded focus:ring-[#2e6b4e]"
            />
            <span className="text-sm text-[#314158]">
              I agree to the{" "}
              <Link to="#" className="text-[#2e6b4e] hover:underline font-medium">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link to="#" className="text-[#2e6b4e] hover:underline font-medium">
                Privacy Policy
              </Link>
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="h-12 w-full bg-[#2e6b4e] text-white rounded-lg font-medium hover:bg-[#255a43] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <div className="flex flex-col gap-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#e2e8f0]" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-[#62748e]">or sign up with</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              className="flex-1 h-12 border border-[#cad5e2] rounded-lg text-base text-[#314158] font-medium hover:bg-gray-50 transition-colors"
            >
              Google
            </button>
            <button
              type="button"
              className="flex-1 h-12 border border-[#cad5e2] rounded-lg text-base text-[#314158] font-medium hover:bg-gray-50 transition-colors"
            >
              Facebook
            </button>
          </div>
        </div>

        <p className="text-sm text-[#62748e] text-center">
          Already have an account?{" "}
          <Link to="/login" className="text-[#2e6b4e] hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;
