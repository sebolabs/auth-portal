import React from "react";
import { Card, Row, Col } from "react-bootstrap";

function SignIn(props) {

  return (
    <Row>
      <Col></Col>
      <Col sm={5}>
        <Card style={{width: "100%", backgroundColor: "lightgrey"}}>
          <Card.Body>
            <Card.Title style={{height: "60px"}} className="d-flex align-items-center justify-content-center">
              <h2>The Portal</h2>
            </Card.Title>
            <Card.Text style={{height: "100px", backgroundColor: "white"}} className="d-flex align-items-center justify-content-center">C'mon in...</Card.Text>
          </Card.Body>
        </Card>
      </Col>
      <Col></Col>
    </Row>
  );
}

export default SignIn;
