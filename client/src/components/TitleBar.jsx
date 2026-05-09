import React from 'react';

export default function TitleBar({user,onSwitch}){ return (
  <div className="topbar">
    <div className="pill welcome">Welcome, {user}!</div>
    <button className="ghost btn" onClick={onSwitch}>Switch User</button>
  </div>
);}
