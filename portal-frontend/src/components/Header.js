import React from "react";
import { Navbar, Nav, NavItem, Button } from "react-bootstrap";
import { Auth } from "aws-amplify";
import logo from "../static/img/logo.png";

function Header(props) {

  return (
    <Navbar bg="dark" variant="dark" expand="lg">
      <Nav className="container-fluid">
        <NavItem>
          <Navbar.Brand><img className="logo" src={logo} alt="" /></Navbar.Brand>
        </NavItem>
        <NavItem className="ms-auto">
          {props.token ? (<Button block="true" variant="danger" onClick={() => Auth.signOut()}>Sign out</Button>) 
          : (<Button block="true" variant="success" onClick={() => Auth.federatedSignIn()}>Sign in</Button>)}
        </NavItem>
      </Nav>
    </Navbar>
  );
}

export default Header;
