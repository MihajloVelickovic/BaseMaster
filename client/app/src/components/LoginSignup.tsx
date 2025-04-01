import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axiosInstance from "../utils/axiosInstance";   //ovde za sad ne treba
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

const LoginSignup = () => {
    // const location = useLocation();
    // var { playerIdTransfered = ""} = location.state || {};
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
    //this method sure is nice but it would be more awsome if we did not use
    //REDIS FOR PERMANENT DATA STORAGE!!!!!!!!!!!!!!!!
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const errors = validate(formValues);
        setFormErrors(errors);

        if (Object.keys(errors).length === 0) {
            try {
                let response;
                var msg = "";
                var userName = "";
                if (action === "Login") {
                    response = await axiosInstance.post("/user/login", {
                        email: formValues.email,
                        password: formValues.password
                    });
                    msg = response.data['message'];
                    userName = response.data['fullUsername'];
                    console.log(msg, userName);
                    //console.log(response);
                    //setUserId(response.data.userId);
                    navigate("/", { state: { playerIdTransfered: userName} });
                } else if (action === "Register") {
                    response = await axiosInstance.post("/user/register", {
                        email: formValues.email,
                        username: formValues.username,
                        password: formValues.password
                    });
                    console.log(response);
                    msg = response.data['message'];
                    userName = response.data['fullUsername'];
                    //setUserId(response.data.userId);
                    navigate("/", { state: { playerIdTransfered: userName} });
                } else {
                    console.log("Unknown action..");
                    setFormErrors({ serverResponse: "Unknown action.." });    
                }
            } catch (error: any) {
                let msg = error.response.data.message;
                setFormErrors({ serverResponse: msg? msg : "Error occured.." });
            }
        }
    };


    return (
        <div className="LoginSignupContainer">            
            <div className="lobbyOptionDiv">
                <button className={`btn ${action=="Login" ? 'btn-primary' : 'btn-secondary'} lobbyOptionButton`} onClick={() => setAction("Login")}>
                    Login
                </button>
                <button className={`btn ${action=="Register" ? 'btn-primary' : 'btn-secondary '} lobbyOptionButton`} onClick={() => setAction("Register")}>
                    Register
                </button>
            </div>
            <h2 className="mainFont">{action}</h2>
            <form className="inputs" onSubmit={handleSubmit}>
                {action === "Register" && (
                    <>
                        <input
                            type="text"
                            name="username"
                            placeholder="Username"
                            value={formValues.username}
                            onChange={handleChange}
                        />
                        {formErrors.username && <p className="loginSignupErrors">{formErrors.username}</p>}
                    </>
                )}
                <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    value={formValues.email}
                    onChange={handleChange}
                />
                {formErrors.email && <p className="loginSignupErrors">{formErrors.email}</p>}
                <input
                    type="password"
                    name="password"
                    placeholder="Password"
                    value={formValues.password}
                    onChange={handleChange}
                />
                {formErrors.password && <p className="loginSignupErrors">{formErrors.password}</p>}
                {action === "Register" && (
                    <>
                        <input
                            type="password"
                            name="confirmPassword"
                            placeholder="Confirm Password"
                            value={formValues.confirmPassword}
                            onChange={handleChange}
                        />
                        {formErrors.confirmPassword && <p className="loginSignupErrors">{formErrors.confirmPassword}</p>}
                    </>
                )}
                {formErrors.serverResponse && <p className="loginSignupErrors">{formErrors.serverResponse}</p>}
                <button className="createLobbyButton" type="submit">{action}</button>
            </form>
            {userId && <p>Logged in as: {formValues.username}_{userId}</p>}
        </div>
    );
};

export default LoginSignup;
