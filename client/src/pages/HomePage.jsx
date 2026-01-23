import { useNavigate } from "react-router-dom";
import { logout } from "../api";

function HomePage() {
  const navigate = useNavigate();
  const userStr = localStorage.getItem("eventure_user");
  const user = userStr ? JSON.parse(userStr) : null;

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      // Clear localStorage
      localStorage.removeItem("eventure_user");
      // Redirect to login
      navigate("/login");
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h1 style={styles.title}>Eventure Home</h1>
        {user && (
          <p style={styles.welcome}>
            Welcome, {user.firstName}!
          </p>
        )}
        <button onClick={handleLogout} style={styles.button}>
          Logout
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#f5f5f5",
    padding: "20px",
  },
  content: {
    maxWidth: "1200px",
    margin: "0 auto",
    backgroundColor: "white",
    padding: "2rem",
    borderRadius: "8px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
  },
  title: {
    color: "#333",
    marginBottom: "1rem",
  },
  welcome: {
    color: "#666",
    fontSize: "1.1rem",
    marginBottom: "2rem",
  },
  button: {
    padding: "0.75rem 1.5rem",
    backgroundColor: "#333",
    color: "white",
    border: "none",
    borderRadius: "4px",
    fontSize: "1rem",
    cursor: "pointer",
  },
};

export default HomePage;
