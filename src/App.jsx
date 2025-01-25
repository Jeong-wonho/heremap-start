import Map from "./components/Map";
import "./App.css";

const apikey = import.meta.env.VITE_HERE_API_KEY;

function App() {
  return (
    <div>
      <Map apikey={apikey} />
    </div>
  );
}

export default App;
