function GameStats() {
  return (
    <div>
      <div>1st place count: </div>
      <div>2nd place count: </div>
      <div>3rd place count: </div>
      <div>4th place count: </div>
      <div>Total games: </div>
      <div>High score: </div>
    </div>
  );
}

function Profile() {
  return (
    <>
      <GameStats />
    </>
  );
}

export default Profile;
