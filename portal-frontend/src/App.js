import React, { useEffect, useState, Fragment } from "react";
import { Amplify, Auth, Hub } from "aws-amplify";
import { Container } from "react-bootstrap";
import Navigation from "./components/Header.js";
import SignIn from "./components/SignIn.js";
import Main from "./components/Main.js";
import "./App.css";

const authConfig = process.env.AUTH_CONFIG || {
  region: "???",
  userPoolId: "???",
  userPoolWebClientId: "???",
  oauth: {
    domain: "???",
    scope: ["email", "openid", "profile"],
    redirectSignIn: "???",
    redirectSignOut: "???",
    responseType: "code"
  }
};

Amplify.configure({Auth: authConfig});

function App() {
  const [token, setToken] = useState(null);

  useEffect(() => {
    Hub.listen("auth", ({payload: {event, data}}) => {
      switch(event) {
        case "signIn":
        case "cognitoHostedUI":
          getToken().then(userToken => setToken(userToken.idToken.jwtToken));
          break;
        case "signOut":
          setToken(null);
          break;
        case "signIn_failure":
        case "cognitoHostedUI_failure":
          console.log("Sign in failure", data);
          break;
        default:
          break;
      }
    });

  }, []);

  function getToken() {
    return Auth.currentSession()
      .then(session => session)
      .catch(err => console.log(err));
  }

  return (
    <Fragment>
      <Navigation token={token}/>
      <Container fluid>
        <br />
        {token ? (<Main token={token}/>) : (<SignIn/>)}
      </Container>
    </Fragment>
  );
}

export default App;
