import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../api";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await login(email, password);
      // Save user to localStorage
      localStorage.setItem("eventure_user", JSON.stringify(data.user));
      // Navigate to home
      navigate("/");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-5 font-['Arimo',sans-serif]">
      <div className="w-full max-w-[382px] bg-white border border-[#e2e8f0] rounded-2xl shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)] p-[33px] flex flex-col gap-6">
        <div className="flex flex-col gap-6">
          <h1 className="text-2xl text-[#0f172b] text-center">Eventure</h1>
          <h2 className="text-base text-[#45556c] text-center font-normal">Login</h2>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-center text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-base text-[#314158]">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
              className="h-[50px] rounded-lg border border-[#cad5e2] pl-10 pr-4 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2e6b4e] focus:border-transparent"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-base text-[#314158]">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              className="h-[50px] rounded-lg border border-[#cad5e2] pl-10 pr-4 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2e6b4e] focus:border-transparent"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 text-[#2e6b4e] border-gray-300 rounded focus:ring-[#2e6b4e]"
              />
              <span className="text-base text-[#314158]">Remember me</span>
            </label>
            <Link
              to="#"
              className="text-base text-[#2e6b4e] hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-[#2e6b4e] text-white rounded-lg font-medium hover:bg-[#255a43] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="flex flex-col gap-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#e2e8f0]"></div>
            </div>
            <div className="relative flex justify-center text-base">
              <span className="bg-white px-2 text-[#62748e]">or continue with</span>
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

        <p className="text-base text-[#62748e] text-center">
          Don't have an account?{" "}
          <Link to="/register" className="text-[#2e6b4e] hover:underline font-medium">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
