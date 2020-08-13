import React from "react";
import styled, { css } from "styled-components";

const Body = styled.div`
  display: inline-block;
  background-color: ${({ fillColor }) => fillColor};
  box-sizing: content-box;
  height: 1em;
  margin: 0 2px 0 2px;
  padding: 3px 12px 3px 12px;
  color: white;
  font-size: 14px;
  line-height: 12px;
  border-radius: 10px;
  font-weight: bold;
  text-align: center;
  vertical-align: bottom;

  ${({ maxWidth }) =>
    maxWidth
      ? css`
          max-width: ${isNaN(maxWidth) ? maxWidth : maxWidth + "px"};
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        `
      : undefined}
`;

const Tag = ({ name, title, color = "blue", maxWidth }) => {
  return (
    <Body title={title || name} fillColor={color} maxWidth={maxWidth}>
      {name}
    </Body>
  );
};

Tag.Body = Body;

export default Tag;
