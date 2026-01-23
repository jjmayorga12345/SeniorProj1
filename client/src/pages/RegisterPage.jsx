import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../api";

function RegisterPage() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await register(formData);
      // Navigate to login page
      navigate("/login");
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-5 font-['Arimo',sans-serif]">
      <div className="w-full max-w-[382px] bg-white border border-[#e2e8f0] rounded-2xl shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)] p-[33px] flex flex-col gap-6">
        <div className="flex flex-col gap-6">
          <h1 className="text-2xl text-[#0f172b] text-center">Eventure</h1>
          <h2 className="text-base text-[#45556c] text-center font-normal">Create Account</h2>
          <p className="text-base text-[#45556c] text-center font-normal">Sign up to get started</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-center text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="firstName" className="text-base text-[#314158]">
              First Name
            </label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              required
              placeholder="Enter your first name"
              className="h-[50px] rounded-lg border border-[#cad5e2] pl-10 pr-4 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2e6b4e] focus:border-transparent"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="lastName" className="text-base text-[#314158]">
              Last Name
            </label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              required
              placeholder="Enter your last name"
              className="h-[50px] rounded-lg border border-[#cad5e2] pl-10 pr-4 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2e6b4e] focus:border-transparent"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-base text-[#314158]">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
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
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Enter your password"
              className="h-[50px] rounded-lg border border-[#cad5e2] pl-10 pr-4 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2e6b4e] focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-[#2e6b4e] text-white rounded-lg font-medium hover:bg-[#255a43] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Registering..." : "Register"}
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
          Already have an account?{" "}
          <Link to="/login" className="text-[#2e6b4e] hover:underline font-medium">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;
