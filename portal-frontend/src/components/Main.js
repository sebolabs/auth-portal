import React from "react";
import { Card, Row, Col, ListGroup } from "react-bootstrap";
import jwt_decode from 'jwt-decode';

function Main(props) {

  const jwtToken = jwt_decode(props.token);
  const username = jwtToken["preferred_username"];
  const displayName = jwtToken["given_name"] + " " + jwtToken["family_name"];
  const userDetails = jwtToken["custom:job_title"] + " (" + jwtToken["custom:employee_id"] + ") @ " + jwtToken["custom:company_name"];

  return (
    <Row>
      <Col></Col>
      <Col sm={5}>
        <Card style={{width: "100%", backgroundColor: "lightgrey"}}>
          <Card.Body>
          <Card.Title style={{height: "60px"}} className="d-flex align-items-center justify-content-center">
              <h2>The Portal</h2>
            </Card.Title>
            <Card.Text style={{height: "50px", backgroundColor: "white"}} className="d-flex align-items-center justify-content-center">
              Hiya
            </Card.Text>
            <Card>
              <Card.Header><b>{displayName}</b></Card.Header>
              <ListGroup variant="flush">
                <ListGroup.Item>{username}</ListGroup.Item>
                <ListGroup.Item>{userDetails}</ListGroup.Item>
              </ListGroup>
            </Card>
          </Card.Body>
        </Card>
      </Col>
      <Col></Col>
    </Row>
  );
}

export default Main;
