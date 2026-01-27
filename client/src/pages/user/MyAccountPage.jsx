import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../../components/layout/AppShell";
import { getCurrentUser, getUserRole } from "../../utils/auth";
import {
  getProfile,
  requestChangePasswordCode,
  changePassword,
  requestDeleteAccountCode,
  deleteAccount,
  logout,
  uploadProfilePicture,
  updateProfileSettings,
} from "../../api";

function MyAccountPage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const role = getUserRole();
  const [activeTab, setActiveTab] = useState("profile");
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Change Password Modal State
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [changePasswordStep, setChangePasswordStep] = useState("request"); // "request" | "verify" | "reset"
  const [changePasswordData, setChangePasswordData] = useState({
    code: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState("");

  // Delete Account Modal State
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteAccountStep, setDeleteAccountStep] = useState("confirm"); // "confirm" | "verify"
  const [deleteAccountCode, setDeleteAccountCode] = useState("");
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState("");
  
  // Profile picture and contact info state
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [updatingSettings, setUpdatingSettings] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getProfile();
        setProfile(data);
      } catch (err) {
        console.error("Failed to load profile:", err);
        setError(err.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleChangePasswordRequest = async () => {
    try {
      setChangePasswordLoading(true);
      setChangePasswordError("");
      await requestChangePasswordCode();
      setChangePasswordStep("verify");
    } catch (err) {
      setChangePasswordError(err.message || "Failed to send verification code");
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const handleChangePasswordVerify = async (e) => {
    e.preventDefault();
    setChangePasswordError("");

    if (!/^\d{6}$/.test(changePasswordData.code)) {
      setChangePasswordError("Code must be exactly 6 digits");
      return;
    }

    if (changePasswordData.newPassword.length < 8) {
      setChangePasswordError("Password must be at least 8 characters");
      return;
    }

    if (changePasswordData.newPassword !== changePasswordData.confirmPassword) {
      setChangePasswordError("Passwords do not match");
      return;
    }

    try {
      setChangePasswordLoading(true);
      await changePassword(changePasswordData.code, changePasswordData.newPassword);
      setShowChangePassword(false);
      setChangePasswordStep("request");
      setChangePasswordData({ code: "", newPassword: "", confirmPassword: "" });
      alert("Password changed successfully!");
    } catch (err) {
      setChangePasswordError(err.message || "Failed to change password");
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const handleDeleteAccountRequest = async () => {
    try {
      setDeleteAccountLoading(true);
      setDeleteAccountError("");
      await requestDeleteAccountCode();
      setDeleteAccountStep("verify");
    } catch (err) {
      setDeleteAccountError(err.message || "Failed to send verification code");
    } finally {
      setDeleteAccountLoading(false);
    }
  };

  const handleDeleteAccountVerify = async (e) => {
    e.preventDefault();
    setDeleteAccountError("");

    if (!/^\d{6}$/.test(deleteAccountCode)) {
      setDeleteAccountError("Code must be exactly 6 digits");
      return;
    }

    try {
      setDeleteAccountLoading(true);
      await deleteAccount(deleteAccountCode);
      // Logout and redirect
      await logout();
      localStorage.removeItem("eventure_token");
      localStorage.removeItem("eventure_user");
      navigate("/login", { replace: true });
    } catch (err) {
      setDeleteAccountError(err.message || "Failed to delete account");
    } finally {
      setDeleteAccountLoading(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2e6b4e] mx-auto mb-4"></div>
            <p className="text-[#45556c]">Loading profile...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !profile) {
    return (
      <AppShell>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600">{error || "Failed to load profile"}</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const initials = `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`.toUpperCase();
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const profilePictureUrl = profile?.user?.profilePicture 
    ? (profile.user.profilePicture.startsWith("http") 
        ? profile.user.profilePicture 
        : `${API_URL}${profile.user.profilePicture}`)
    : null;

  const handleProfilePictureUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploadingPicture(true);
      const result = await uploadProfilePicture(file);
      // Reload profile to get updated picture
      const updatedProfile = await getProfile();
      setProfile(updatedProfile);
      alert("Profile picture updated successfully!");
    } catch (err) {
      console.error("Failed to upload profile picture:", err);
      alert(err.message || "Failed to upload profile picture");
    } finally {
      setUploadingPicture(false);
    }
  };

  const handleToggleContactInfo = async (e) => {
    const newValue = e.target.checked;
    try {
      setUpdatingSettings(true);
      await updateProfileSettings({ showContactInfo: newValue });
      // Reload profile to get updated setting
      const updatedProfile = await getProfile();
      setProfile(updatedProfile);
    } catch (err) {
      console.error("Failed to update settings:", err);
      alert(err.message || "Failed to update settings");
      // Revert checkbox
      e.target.checked = !newValue;
    } finally {
      setUpdatingSettings(false);
    }
  };

  return (
    <AppShell>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-5">
          {/* Profile Summary Card */}
          <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-6 mb-6">
            <div className="flex items-center gap-6">
              {/* Avatar */}
              <div className="relative">
                {profilePictureUrl ? (
                  <img
                    src={profilePictureUrl}
                    alt={`${user?.firstName} ${user?.lastName}`}
                    className="w-24 h-24 rounded-full object-cover border-2 border-[#e2e8f0]"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-[#2e6b4e] flex items-center justify-center text-white text-2xl font-bold">
                    {initials}
                  </div>
                )}
                <label className="absolute bottom-0 right-0 w-8 h-8 bg-white border-2 border-[#e2e6b4e] rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePictureUpload}
                    disabled={uploadingPicture}
                    className="hidden"
                  />
                  {uploadingPicture ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#2e6b4e]"></div>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-[#45556c]"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  )}
                </label>
              </div>

              {/* User Info */}
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-[#0f172b] mb-1">
                  {user?.firstName} {user?.lastName}
                </h2>
                <p className="text-[#45556c] mb-2">{user?.email}</p>
                <div className="flex items-center gap-2 text-[#45556c] text-sm">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span>Providence, RI</span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex flex-col gap-4">
                <div className="text-right">
                  <p className="text-2xl font-bold text-[#0f172b]">{profile.stats.eventsHosted}</p>
                  <p className="text-sm text-[#45556c]">Events</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-[#0f172b]">{profile.stats.eventsAttending}</p>
                  <p className="text-sm text-[#45556c]">Attending</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-[#0f172b]">{profile.stats.favorites}</p>
                  <p className="text-sm text-[#45556c]">Favorites</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-6 border-b border-[#e2e8f0] mb-6">
            <button
              onClick={() => setActiveTab("profile")}
              className={`pb-4 px-1 font-medium transition-colors ${
                activeTab === "profile"
                  ? "text-[#2e6b4e] border-b-2 border-[#2e6b4e]"
                  : "text-[#45556c] hover:text-[#0f172b]"
              }`}
            >
              Profile
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`pb-4 px-1 font-medium transition-colors ${
                activeTab === "settings"
                  ? "text-[#2e6b4e] border-b-2 border-[#2e6b4e]"
                  : "text-[#45556c] hover:text-[#0f172b]"
              }`}
            >
              Settings
            </button>
            {role === "admin" && (
              <button
                onClick={() => setActiveTab("admin")}
                className={`pb-4 px-1 font-medium transition-colors ${
                  activeTab === "admin"
                    ? "text-[#2e6b4e] border-b-2 border-[#2e6b4e]"
                    : "text-[#45556c] hover:text-[#0f172b]"
                }`}
              >
                Admin Control Panel
              </button>
            )}
          </div>

          {/* Tab Content */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-[#0f172b] mb-4">Profile Information</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-[#314158]">Name</label>
                    <p className="text-[#45556c] mt-1">
                      {user?.firstName} {user?.lastName}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#314158]">Email</label>
                    <p className="text-[#45556c] mt-1">{user?.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#314158]">Role</label>
                    <p className="text-[#45556c] mt-1 capitalize">{user?.role}</p>
                  </div>
                </div>
              </div>

              {/* Privacy Settings */}
              <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-[#0f172b] mb-4">Privacy Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-[#314158] block mb-1">
                        Show Contact Information on Event Listings
                      </label>
                      <p className="text-sm text-[#45556c]">
                        When enabled, your email will be visible to attendees on your event details pages.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-4">
                      <input
                        type="checkbox"
                        checked={profile?.user?.showContactInfo || false}
                        onChange={handleToggleContactInfo}
                        disabled={updatingSettings}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#2e6b4e]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2e6b4e]"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="space-y-6">
              {/* Security Section */}
              <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-[#2e6b4e]"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <h3 className="text-lg font-semibold text-[#0f172b]">Security</h3>
                </div>
                <div className="space-y-3">
                  <button
                    onClick={() => setShowChangePassword(true)}
                    className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-between"
                  >
                    <span className="text-[#314158]">Change Password</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-[#45556c]"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                  <button className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-between">
                    <span className="text-[#314158]">Two-Factor Authentication</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-[#45556c]"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                  <button className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-between">
                    <span className="text-[#314158]">Connected Accounts</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-[#45556c]"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="bg-white border border-red-200 rounded-2xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-red-600 mb-4">Danger Zone</h3>
                <button
                  onClick={() => setShowDeleteAccount(true)}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
                >
                  Delete Account
                </button>
              </div>
            </div>
          )}

          {activeTab === "admin" && role === "admin" && (
            <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-[#0f172b] mb-4">Admin Control Panel</h3>
              <p className="text-[#45556c]">Admin features coming soon...</p>
            </div>
          )}
        </div>
      </div>

      {/* Change Password Modal */}
      {showChangePassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-5">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-[#0f172b] mb-4">Change Password</h3>

            {changePasswordStep === "request" && (
              <div>
                <p className="text-[#45556c] mb-4">
                  We'll send a verification code to your email to confirm the password change.
                </p>
                {changePasswordError && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{changePasswordError}</div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowChangePassword(false);
                      setChangePasswordStep("request");
                      setChangePasswordError("");
                    }}
                    className="flex-1 px-4 py-2 bg-white border border-[#cad5e2] text-[#314158] rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleChangePasswordRequest}
                    disabled={changePasswordLoading}
                    className="flex-1 px-4 py-2 bg-[#2e6b4e] text-white rounded-lg font-medium hover:bg-[#255a43] transition-colors disabled:opacity-50"
                  >
                    {changePasswordLoading ? "Sending..." : "Send Code"}
                  </button>
                </div>
              </div>
            )}

            {changePasswordStep === "verify" && (
              <form onSubmit={handleChangePasswordVerify} className="space-y-4">
                <p className="text-[#45556c] mb-4">Enter the verification code sent to your email and your new password.</p>
                {changePasswordError && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{changePasswordError}</div>
                )}
                <div>
                  <label className="text-sm font-medium text-[#314158] mb-1 block">Verification Code</label>
                  <input
                    type="text"
                    value={changePasswordData.code}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, "");
                      if (digitsOnly.length <= 6) {
                        setChangePasswordData({ ...changePasswordData, code: digitsOnly });
                      }
                    }}
                    maxLength={6}
                    placeholder="Enter 6-digit code"
                    className="w-full h-12 px-4 rounded-lg border border-[#cad5e2] text-center tracking-widest text-lg font-mono focus:outline-none focus:ring-2 focus:ring-[#2e6b4e]"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#314158] mb-1 block">New Password</label>
                  <input
                    type="password"
                    value={changePasswordData.newPassword}
                    onChange={(e) => setChangePasswordData({ ...changePasswordData, newPassword: e.target.value })}
                    placeholder="At least 8 characters"
                    minLength={8}
                    className="w-full h-12 px-4 rounded-lg border border-[#cad5e2] focus:outline-none focus:ring-2 focus:ring-[#2e6b4e]"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#314158] mb-1 block">Confirm Password</label>
                  <input
                    type="password"
                    value={changePasswordData.confirmPassword}
                    onChange={(e) => setChangePasswordData({ ...changePasswordData, confirmPassword: e.target.value })}
                    placeholder="Confirm your password"
                    minLength={8}
                    className="w-full h-12 px-4 rounded-lg border border-[#cad5e2] focus:outline-none focus:ring-2 focus:ring-[#2e6b4e]"
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowChangePassword(false);
                      setChangePasswordStep("request");
                      setChangePasswordData({ code: "", newPassword: "", confirmPassword: "" });
                      setChangePasswordError("");
                    }}
                    className="flex-1 px-4 py-2 bg-white border border-[#cad5e2] text-[#314158] rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={changePasswordLoading}
                    className="flex-1 px-4 py-2 bg-[#2e6b4e] text-white rounded-lg font-medium hover:bg-[#255a43] transition-colors disabled:opacity-50"
                  >
                    {changePasswordLoading ? "Changing..." : "Change Password"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-5">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-red-600 mb-4">Delete Account</h3>

            {deleteAccountStep === "confirm" && (
              <div>
                <p className="text-[#45556c] mb-4">
                  Are you sure you want to delete your account? This action cannot be undone. All your data will be permanently deleted.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowDeleteAccount(false);
                      setDeleteAccountStep("confirm");
                      setDeleteAccountCode("");
                      setDeleteAccountError("");
                    }}
                    className="flex-1 px-4 py-2 bg-white border border-[#cad5e2] text-[#314158] rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccountRequest}
                    disabled={deleteAccountLoading}
                    className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {deleteAccountLoading ? "Sending..." : "Continue"}
                  </button>
                </div>
              </div>
            )}

            {deleteAccountStep === "verify" && (
              <form onSubmit={handleDeleteAccountVerify} className="space-y-4">
                <p className="text-[#45556c] mb-4">
                  Enter the verification code sent to your email to confirm account deletion.
                </p>
                {deleteAccountError && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{deleteAccountError}</div>
                )}
                <div>
                  <label className="text-sm font-medium text-[#314158] mb-1 block">Verification Code</label>
                  <input
                    type="text"
                    value={deleteAccountCode}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, "");
                      if (digitsOnly.length <= 6) {
                        setDeleteAccountCode(digitsOnly);
                      }
                    }}
                    maxLength={6}
                    placeholder="Enter 6-digit code"
                    className="w-full h-12 px-4 rounded-lg border border-[#cad5e2] text-center tracking-widest text-lg font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteAccount(false);
                      setDeleteAccountStep("confirm");
                      setDeleteAccountCode("");
                      setDeleteAccountError("");
                    }}
                    className="flex-1 px-4 py-2 bg-white border border-[#cad5e2] text-[#314158] rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={deleteAccountLoading}
                    className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {deleteAccountLoading ? "Deleting..." : "Delete Account"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default MyAccountPage;
