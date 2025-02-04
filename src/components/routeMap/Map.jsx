import { useState, useEffect, useRef } from "react";
import H from "@here/maps-api-for-javascript";
import "./Map.css";
import { clusterData } from "./data";

const Map = ({
  apikey,
  option,
  departureOption,
  destinationOption,
  region,
}) => {
  const mapRef = useRef(null);
  const map = useRef(null);
  const platform = useRef(null);
  const panelRef = useRef(null);
  const clusteringLayerRef = useRef(null);
  const geoJSONLayerRef = useRef(null);
  const circleRef = useRef(null);
  const ui = useRef(null);
  const [waypoints, setWaypoints] = useState("");
  const [summary, setSummary] = useState({ duration: 0, distance: 0 });
  const [manuevers, setManuevers] = useState([]);
  const [clickedPosition, setClickedPosition] = useState({ lat: 0, lng: 0 });
  useEffect(() => {
    // Check if the map object has already been created
    if (!map.current) {
      // Create a platform object with the API key and useCIT option
      platform.current = new H.service.Platform({
        apikey,
        https: false,
      });

      // Obtain the default map types from the platform object:
      const defaultLayers = platform.current.createDefaultLayers({
        pois: true,
      });

      // Create a new map instance with the Tile layer, center and zoom level
      // Instantiate (and display) a map:
      const newMap = new H.Map(
        mapRef.current,
        defaultLayers.vector.normal.map,
        {
          zoom: 7,
          center: { lat: 34.061966881560096, lng: -118.23685846823405 }, 
          pixelRatio: window.devicePixelRatio || 1,
        }
      );

      // Add panning and zooming behavior to the map
      new H.mapevents.Behavior(new H.mapevents.MapEvents(newMap));

      ui.current = H.ui.UI.createDefault(newMap, defaultLayers);

      // Set the map object to the reference
      map.current = newMap;

      setUpClickListener(map.current);
    }
  }, [apikey]);

  // 드롭다운 옵션 변경에 따른 맵 업데이트
  useEffect(() => {
    if (!map.current || !ui.current) return;
    const service = platform.current.getSearchService();
    console.log("option", option);
    if (map.current) {
      map.current.removeObjects(map.current.getObjects());
    }

    if (clusteringLayerRef.current && option !== "cluster") {
      map.current.removeLayer(clusteringLayerRef.current);
      clusteringLayerRef.current = null;
    }

    if (geoJSONLayerRef.current) {
      map.current.removeLayer(geoJSONLayerRef.current);
      geoJSONLayerRef.current = null;
    }

    if (
      option === "route" &&
      departureOption.latitude &&
      departureOption.longitude &&
      destinationOption.latitude &&
      destinationOption.longitude
    ) {
      calucateRouteFromAtoB(
        platform.current,
        map.current,
        ui.current,
        departureOption,
        destinationOption
      );
    } else if (option === "cluster") {
      startClustering(map.current, clusterData, ui.current, service);
    } else if (option === "geofence") {
      showGeoJSONData(map.current, region);
    } else if (option === "polyline") {
      addPolylineToMap(map.current);
    } else if (option === "circle") {
      addCircleToMap(map.current);
    } else if (option === "rectangle") {
      addRectangleToMap(map.current);
    }
    // 추가 옵션에 따른 업데이트 로직을 여기에 작성합니다.
  }, [option, departureOption, destinationOption, region]);

  function calucateRouteFromAtoB(
    platform,
    map,
    ui,
    departureOption,
    destinationOption
  ) {
    let router = platform.getRoutingService(null, 8);
    let routeRequestParams = {
      routingMode: "fast",
      transportMode: "truck",
      origin: `${departureOption.latitude},${departureOption.longitude}`, // Brandenburg Gate
      destination: `${destinationOption.latitude},${destinationOption.longitude}`, // Friedrichstraße Railway Station
      return: "polyline,turnByTurnActions,actions,instructions,travelSummary",
    };

    router.calculateRoute(
      routeRequestParams,
      (result) => onSuccess(result, map, ui),
      onError
    );
  }

  function onSuccess(result, map, ui) {
    let route = result.routes[0];
    addRouteShapeToMap(route, map);
    addManueversToMap(route, map, ui);
    addWaypointsToPanel(route);
    addSummaryToPanel(route);
    addManueversToPanel(route);
  }

  function onError(error) {
    console.log("error", error);
    alert("Can't reach the remote server");
  }

  function addRouteShapeToMap(route, map) {
    route.sections.forEach((section) => {
      let linestring = H.geo.LineString.fromFlexiblePolyline(section.polyline);

      //Crate a polyline to displkay to the route;
      let polyline = new H.map.Polyline(linestring, {
        style: {
          lineWidth: 8,
          strokeColor: "rgba(0, 128, 255, 0.7)",
        },
      });

      map.addObject(polyline);
      map.getViewModel().setLookAtData({
        bounds: polyline.getBoundingBox(),
      });
    });
  }

  function addManueversToMap(route, map, ui) {
    let svgMarkup =
        '<svg width="18" height="18" ' +
        'xmlns="http://www.w3.org/2000/svg">' +
        '<circle cx="8" cy="8" r="8" ' +
        'fill="#1b468d" stroke="white" stroke-width="1" />' +
        "</svg>",
      dotIcon = new H.map.Icon(svgMarkup, { anchor: { x: 8, y: 8 } }),
      group = new H.map.Group(),
      i;

    route.sections.forEach((section) => {
      let poly = H.geo.LineString.fromFlexiblePolyline(
        section.polyline
      ).getLatLngAltArray();

      let actions = section.actions;
      // Add a marker for each maneuver
      for (i = 0; i < actions.length; i += 1) {
        let action = actions[i];
        var marker = new H.map.Marker(
          {
            lat: poly[action.offset * 3],
            lng: poly[action.offset * 3 + 1],
          },
          { icon: dotIcon }
        );
        marker.instruction = action.instruction;
        group.addObject(marker);
      }

      group.addEventListener(
        "tap",
        function (evt) {
          console.log("evt point", evt.target.getGeometry());
          map.setCenter(evt.target.getGeometry());
          openBubble(evt.target.getGeometry(), evt.target.instruction, ui);
        },
        false
      );

      // Add the maneuvers group to the map
      map.addObject(group);
    });
  }

  /**
   * Adds a polyline between Dublin, London, Paris and Berlin to the map
   *
   * @param  {H.Map} map      A HERE Map instance within the application
   */
  function addPolylineToMap(map) {
    var lineString = new H.geo.LineString();

    lineString.pushPoint({ lat: 34.14505917480674, lng: -119.19708637721835 });
    lineString.pushPoint({ lat: 34.057353670886904, lng: -118.23390005954201 });
    lineString.pushPoint({ lat: 33.4572923211956, lng: -111.94276226679473 });
    lineString.pushPoint({ lat: 29.441632389913806, lng: -98.25854394118814 });

    map.addObject(new H.map.Polyline(lineString, { style: { lineWidth: 4 } }));
  }

  function openBubble(position, text, ui) {
    let bubble;
    if (!bubble) {
      bubble = new H.ui.InfoBubble(position, {
        content: text,
      });
      ui.addBubble(bubble);
    } else {
      bubble.setPosition(position);
      bubble.setContent(text);
      bubble.open(ui);
    }
  }

  function addWaypointsToPanel(route) {
    const labels = new Set(); // 중복 방지를 위해 Set 사용
    route.sections.forEach((section) => {
      if (section.turnByTurnActions && section.turnByTurnActions.length > 0) {
        section.turnByTurnActions.forEach((action) => {
          // nextRoad가 존재하는 경우
          if (
            action.nextRoad &&
            action.nextRoad.name &&
            action.nextRoad.name[0]
          ) {
            labels.add(action.nextRoad.name[0].value); // Set에 추가
          }
          // currentRoad가 존재하는 경우
          if (
            action.currentRoad &&
            action.currentRoad.name &&
            action.currentRoad.name[0]
          ) {
            labels.add(action.currentRoad.name[0].value); // Set에 추가
          }
        });
      } else {
        console.warn("No turnByTurnActions found in section:", section);
      }
    });
    setWaypoints(Array.from(labels).join(" - ")); // Set을 배열로 변환하여 join
  }

  function addSummaryToPanel(route) {
    let distance = 0;
    let duration = 0;

    route.sections.forEach((section) => {
      distance += section.travelSummary.length;
      duration += section.travelSummary.duration;
    });

    setSummary({ duration: toMMSS(duration), distance: distance });
  }

  function addManueversToPanel(route) {
    const maneuversList = [];
    route.sections.forEach((section) => {
      section.actions.forEach((action, idx) => {
        maneuversList.push(
          <li key={idx}>
            <span
              className={`arrow ${action.direction || ""}${action.action}`}
            ></span>
            <span>{section.actions[idx].instruction}</span>
          </li>
        );
      });
    });
    setManuevers(maneuversList);
  }

  /**
   * An event listener is added to listen to tap events on the map.
   * Clicking on the map displays an alert box containing the latitude and longitude
   * of the location pressed.
   * @param  {H.Map} map      A HERE Map instance within the application
   */
  function setUpClickListener(map) {
    // Attach an event listener to map display
    // obtain the coordinates and display in an alert box.
    map.addEventListener("tap", function (evt) {
      const coord = map.screenToGeo(
        evt.currentPointer.viewportX,
        evt.currentPointer.viewportY
      );

      if (circleRef.current !== null) {
        map.removeObject(circleRef.current);
        circleRef.current = null;
      }

  
        circleRef.current = new H.map.Circle(
          { lat: coord.lat, lng: coord.lng }, // 클릭한 위치의 위경도 사용
          10000, // 반경 (미터 단위)
          {
            style: {
              strokeColor: "rgba(55, 85, 170, 0.6)", // 테두리 색상
              lineWidth: 2,
              fillColor: "rgba(0, 128, 0, 0.7)", // 내부 채우기 색상
            },
          }
        );
        // 새 circle을 지도에 추가
        map.addObject(circleRef.current);
        setClickedPosition({ lat: coord.lat, lng: coord.lng });
      

      alert(
        "Clicked at " +
          Math.abs(coord.lat.toFixed(4)) +
          (coord.lat > 0 ? "N" : "S") +
          " " +
          Math.abs(coord.lng.toFixed(4)) +
          (coord.lng > 0 ? "E" : "W")
      );
    });
  }

  function toMMSS(duration) {
    return (
      Math.floor(duration / 60) + " minutes " + (duration % 60) + " seconds"
    );
  }

  //clustering
  function startClustering(map, data, ui, service) {
    let dataPoints = data.map(function (item) {
      return new H.clustering.DataPoint(
        item.latitude,
        item.longitude,
        1,
        item.name
      );
    });

    //Create a clustering provider with custom options for clusterizing the input
    let clusteredDataProvider = new H.clustering.Provider(dataPoints, {
      clusteringOptions: {
        eps: 32,
        minWeight: 2,
      },
    });

    clusteredDataProvider.addEventListener("tap", function (evt) {
      let marker = evt.target;
      let point = marker.getData();

      let isCluster = point.isCluster();

      // 소수점 5째자리까지 반올림
      const lat = marker.getGeometry().lat;
      const lng = marker.getGeometry().lng;

      if (isCluster) {
        point.forEachDataPoint((dataPoint) => {
          console.log(
            "Clicked location latitude",
            dataPoint.getPosition().lat,
            "longitude",
            dataPoint.getPosition().lng,
            "name",
            dataPoint.getData()
          );
        });
      } else {
        service.geocode(
          {
            q: point.getData(),
            at: lat + "," + lng,
            in: "countryCode:USA",
          },
          (result) => {
            result.items.forEach((item) => {
              console.log("item", item);
              openBubble(item.position, item.address.label, ui);
            });
          },
          alert
        );
      }
    });

    // Create a layer that will hold the clustered data points
    clusteringLayerRef.current = new H.map.layer.ObjectLayer(
      clusteredDataProvider
    );
    // Add the clustered layer to the map
    map.addLayer(clusteringLayerRef.current);
  }

  /**
   *
   * @param {*} map 객체만 넘겨줍니다.
   */
  function showGeoJSONData(map, region) {
    // Create GeoJSON reader which will download the specified file.
    // Shape of the file was obtained by using HERE Geocoding and Search API.
    // It is possible to customize look and feel of the objects.
    const reader = new H.data.geojson.Reader(
      "./src/components/routeMap/" + region,
      {
        // This function is called each time parser detects a new map object
        style: function (mapObject) {
          // Parsed geo objects could be styled using setStyle method
          if (mapObject instanceof H.map.Polygon) {
            mapObject.setStyle({
              fillColor: "rgba(255, 0, 0, 0.2)",
              strokeColor: "rgba(0, 255, 255, 0.2)",
              lineWidth: 3,
            });
          }
        },
      }
    );
    // Start parsing the file
    reader.parse();

    geoJSONLayerRef.current = reader.getLayer();

    // Add layer which shows GeoJSON data on the map
    map.addLayer(geoJSONLayerRef.current);
  }

  /**
   * Adds a circle over New Delhi with a radius of 1000 metres onto the map
   *
   * @param  {H.Map} map      A HERE Map instance within the application
   */
  function addCircleToMap(map) {
    circleRef.current = new H.map.Circle(
      { lat: 34.05906026395163, lng: -118.36161612490494 },
      10000,
      {
        style: {
          strokeColor: "rgba(55, 85, 170, 0.6)",
          lineWidth: 2,
          
        },
      }
    );
    map.addObject(circleRef.current);
  }

  /**
 * Adds a rectangle to the map
 *
 * @param  {H.Map} map      A HERE Map instance within the application
 */
function addRectangleToMap(map) {
  var boundingBox = new H.geo.Rect(33.9, -118.09, 33.7, -117.81); 
  map.addObject(
    new H.map.Rect( boundingBox, {
      style: {
        strokeColor: "rgba(55, 85, 170, 0.6)",
        fillColor: "rgba(0, 128, 0, 0.7)",
        lineWidth: 8,
      },
    })
  );
}
  // Return a div element to hold the map
  return (
    <div className="mt-20">
      {/* <div ref={mapRef} style={{ width: "90%", height: "500px" }} /> */}
      <div ref={mapRef} className="w-9/12 h-150 m-auto" />
      {option === "route" && (
        <div ref={panelRef}>
          <div>
            <h3 className="text-lg font-bold mx-5">{waypoints}</h3>
            <div
              style={{ fontSize: "small", marginLeft: "5%", marginRight: "5%" }}
            >
              <b>Total Distance:</b> {summary.distance + "m."}
              <br />
              <b>Travel Time:</b> {summary.duration + " (in current traffic)"}
            </div>
            <ol
              style={{ fontSize: "small", marginLeft: "5%", marginRight: "5%" }}
              className="directions"
            >
              {manuevers}
            </ol>
          </div>
        </div>
      )}
      {option === "mouseclick" && (
        <div>
          <div>
          <h3 className="text-lg font-bold mx-5">클릭한 위치</h3>
          <div
              style={{ fontSize: "small", marginLeft: "5%", marginRight: "5%" }}
            >
              <b>lat:</b> {clickedPosition.lat}
              <br />
              <b>lng:</b> {clickedPosition.lng}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Map;
