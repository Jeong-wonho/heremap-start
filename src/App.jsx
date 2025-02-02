// import H from "@here/maps-api-for-javascript";
import "./components/routeMap/Map.css";
import Map from "./components/routeMap/Map";
// import TailwindComp from "./components/tailwindComponents/TailwindComp";
import Dropdown from "./components/common/Dropdown";
import { useState } from "react";
import { clusterData } from "./components/routeMap/data";

const apikey = import.meta.env.VITE_HERE_API_KEY;

function App() {
  const [selectedOption, setSelectedOption] = useState(null);
  const [selectedValue, setSelectedValue] = useState(null);
  const [departure, setDeparture] = useState("");
  const [departureOption, setDepartureOption] = useState({});
  const [destination, setDestination] = useState("");
  const [destinationOption, setDestinationOption] = useState({});
  const [clusterChoice, setClusterChoice] = useState("");
  const [region, setRegion] = useState("");

  // 드롭다운 옵션
  const mainOptions = [
    { value: "route", label: "Routing & Legs" },
    { value: "cluster", label: "Clustering" },
    { value: "geofence", label: "Geofence" },
  ];

  // 출발지 dropdown 옵션
  const routeDepartureOptions = [
    ...clusterData.map((item) => ({
      value: item.address,
      label: item.name,
      latitude: item.latitude,
      longitude: item.longitude,
    })),
  ];

  // 도착지 dropdown 옵션
  const routeDestinationOptions = [
    ...clusterData.map((item) => ({
      value: item.address,
      label: item.name,
      latitude: item.latitude,
      longitude: item.longitude,
    })),
  ];

  // 클러스터 dropdown 옵션
  const clusterOptions = [
    { value: "cluster1", label: "Cluster 1" },
    { value: "cluster2", label: "Cluster 2" },
  ];

  // 지오펜스 dropdown 옵션
  const geofenceOptions = [
    { value: "los_angeles.json", label: "LA" },
    { value: "newyork.json", label: "New York" },
    { value: "washington.json", label: "Washington" },
    { value: "alabama.json", label: "Alabama" },
  ];

  const handleSelect = (option) => {
    setSelectedOption(option.label); // 선택된 옵션의 레이블로 상태 업데이트
    setSelectedValue(option.value);
  };

  return (
    <div>
      {/* <TailwindComp /> */}
      <div className="ml-20 mt-10">
        <h1 className="text-2xl font-bold py-3">Heremap 샘플 입니다.</h1>
        <div className="flex flex-row">
          <Dropdown
            options={mainOptions}
            selectedOption={selectedOption}
            onSelect={handleSelect}
          />
          {/* Route 선택 시, 출발지와 도착지를 위한 Dropdown 2개 */}
          {selectedValue === "route" && (
            <div className="flex space-x-4 ml-5">
              <div className="flex flex-row">
                <p className="mr-2">출발지</p>
                <Dropdown
                  options={routeDepartureOptions}
                  selectedOption={departure}
                  onSelect={(option) => {
                    console.log("option", option);
                    setDeparture(option.label);
                    setDepartureOption(option);
                    // 출발지가 변경되면 도착지를 초기화할 수도 있음
                    if (destination === option.label) {
                      setDestination("");
                      setDestinationOption({});
                    }
                  }}
                />
              </div>
              <div className="flex flex-row">
                <p className="mr-2">도착지</p>
                <Dropdown
                  // departure로 선택된 값은 도착지 옵션에서 제외합니다.
                  options={routeDestinationOptions.filter(
                    (option) => option.label !== departure
                  )}
                  selectedOption={destination}
                  onSelect={(option) => {
                    console.log("option", option);
                    setDestination(option.label);
                    setDestinationOption(option);
                  }}
                />
              </div>
            </div>
          )}
          {/* Geofence 선택 시, 지역 선택 Dropdown */}
          {selectedValue === "geofence" && (
            <div className="ml-5">
              <Dropdown
                options={geofenceOptions}
                selectedOption={region}
                onSelect={(option) => setRegion(option.value)}
              />
            </div>
          )}
        </div>
      </div>
      <Map
        apikey={apikey}
        option={selectedValue}
        departureOption={departureOption}
        destinationOption={destinationOption}
        region={region}
      />
    </div>
  );
}

export default App;
