import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { post } from "../api/http";
import { useStore } from "../store";
import { useI18n } from "../hooks/useI18n";
import { ShieldCheck, Lock, Shield, Link, Atom } from "lucide-react";

export default function Login() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const setAuth = useStore((s) => s.setAuth);

  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!agreedToTerms) {
        setError(t("terms.must_agree"));
        setLoading(false);
        return;
      }

      if (isRegister) {
        // 注册
        const result = await post("/api/users/register", {
          username,
          password,
          nickname: nickname || username,
        });
        // result = { id, username }
        setIsRegister(false);
        setPassword("");
        setError("注册成功，请登录");
        setLoading(false);
        return;
      } else {
        // 登录
        const result = await post("/api/users/login", {
          username,
          password,
        });
        // result = { id, username, token }

        // 映射到 store
        const userData = {
          id: String(result.id),
          username: result.username,
          nickname: result.username,
          avatar: "",
        };

        setAuth(result.token, userData);
        navigate("/chats");
      }
    } catch (err: any) {
      setError(err.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <ShieldCheck size={36} />
        </div>
        <h1 className="login-title">即时通讯</h1>
        <p className="login-subtitle">安全 · 高效 · 实时</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <input
              className="input"
              id="username-input"
              type="text"
              autoComplete="username"
              placeholder="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          {isRegister && (
            <div className="input-group">
              <input
                className="input"
                id="nickname-input"
                type="text"
                placeholder="昵称（可选）"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>
          )}

          <div className="input-group">
            <input
              className="input"
              id="password-input"
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div
              style={{
                color: "var(--danger)",
                fontSize: 13,
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}

          <button
            className="btn btn-primary btn-full"
            type="submit"
            id="submit-btn"
            disabled={loading}
          >
            {loading
              ? isRegister
                ? "注册中..."
                : "登录中..."
              : isRegister
                ? "注册"
                : "登录"}
          </button>
        </form>

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            padding: "8px 4px",
            fontSize: 13,
            color: "var(--text-secondary)",
          }}
        >
          <input
            type="checkbox"
            id="terms-checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            style={{
              marginTop: 2,
              accentColor: "var(--accent)",
              width: 18,
              height: 18,
              flexShrink: 0,
            }}
          />
          <label htmlFor="terms-checkbox" style={{ lineHeight: 1.4 }}>
            我已阅读并同意使用条款
          </label>
        </div>

        <div className="login-toggle">
          {isRegister ? "已有账号？" : "没有账号？"}{" "}
          <a
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
            }}
          >
            {isRegister ? "去登录" : "去注册"}
          </a>
        </div>
      </div>
    </div>
  );
}
