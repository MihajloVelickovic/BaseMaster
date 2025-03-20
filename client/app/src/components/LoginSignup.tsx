import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/LoginSignup.css";

interface FormValues {
    username?: string;
    email: string;
    password: string;
    confirmPassword?: string;
}

interface FormErrors {
    username?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    serverResponse?: string;
}

const LoginSignup: React.FC = () => {
    const [action, setAction] = useState<"Login" | "Register">("Login");
    const [formValues, setFormValues] = useState<FormValues>({
        username: "",
        email: "",
        password: "",
        confirmPassword: ""
    });
    const [formErrors, setFormErrors] = useState<FormErrors>({});
    const [userId, setUserId] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormValues({ ...formValues, [name]: value });
    };

    const validate = (values: FormValues): FormErrors => {
        let errors: FormErrors = {};
        if (action === "Register") {
            if (!values.username) errors.username = "Username is required";
            if (!values.email) errors.email = "Email is required";
            if (!values.password) errors.password = "Password is required";
            if (values.password !== values.confirmPassword) errors.confirmPassword = "Passwords do not match";
        } else {
            if (!values.email) errors.email = "Email is required";
            if (!values.password) errors.password = "Password is required";
        }
        return errors;
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const errors = validate(formValues);
        setFormErrors(errors);

        if (Object.keys(errors).length === 0) {
            try {
                let response;
                if (action === "Login") {
                    response = await axios.post("/api/login", {
                        email: formValues.email,
                        password: formValues.password
                    });
                    setUserId(response.data.userId);
                } else {
                    response = await axios.post("/api/register", {
                        username: formValues.username,
                        email: formValues.email,
                        password: formValues.password
                    });
                    setUserId(response.data.userId);
                }
            } catch (error) {
                setFormErrors({ serverResponse: "Server error, try again later" });
            }
        }
    };

    return (
        <div>
            <h2>{action}</h2>
            <form onSubmit={handleSubmit}>
                {action === "Register" && (
                    <>
                        <input
                            type="text"
                            name="username"
                            placeholder="Username"
                            value={formValues.username}
                            onChange={handleChange}
                        />
                        {formErrors.username && <p>{formErrors.username}</p>}
                    </>
                )}
                <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    value={formValues.email}
                    onChange={handleChange}
                />
                {formErrors.email && <p>{formErrors.email}</p>}
                <input
                    type="password"
                    name="password"
                    placeholder="Password"
                    value={formValues.password}
                    onChange={handleChange}
                />
                {formErrors.password && <p>{formErrors.password}</p>}
                {action === "Register" && (
                    <>
                        <input
                            type="password"
                            name="confirmPassword"
                            placeholder="Confirm Password"
                            value={formValues.confirmPassword}
                            onChange={handleChange}
                        />
                        {formErrors.confirmPassword && <p>{formErrors.confirmPassword}</p>}
                    </>
                )}
                <button type="submit">{action}</button>
            </form>
            {userId && <p>Logged in as: {formValues.username}_{userId}</p>}
            <button onClick={() => setAction(action === "Login" ? "Register" : "Login")}>
                Switch to {action === "Login" ? "Register" : "Login"}
            </button>
        </div>
    );
};

export default LoginSignup;
