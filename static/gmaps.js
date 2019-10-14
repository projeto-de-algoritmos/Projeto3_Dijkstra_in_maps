// var CENTER = [-15.796618, -47.886507] // map center -15.796618, -47.886507
// var DEFAULT_DEST = [-15.797032, -47.883852] // default routing end -15.797032, -47.883852
// var DEFAULT_SOURCE = [-15.799829, -47.893434] // default routing start -15.799829, -47.893434
var CENTER = [-15.744531, -47.889734] // map center
var DEFAULT_DEST = [-15.754457, -47.888474] // default routing end
var DEFAULT_SOURCE = [-15.747822, -47.895372] // default routing start
var eMarker // the marker indicating where routing will start
var sMarker // the marker indicating where routing will end
var predList = {}

var curAnimationID // track which animation is currently running
var plines = {
  list: [],
  timeouts: []
}
var map // google maps API map
var drawSpeeds = {
  // duration between rendering each segment in the graph search
  fast: 3,
  slow: 18,
  instant: 0
}

/*
 * Initiate animation based on current settings
 */
function startAnimation(drawSpeed) {
  var source = sMarker.getPosition()
  var dest = eMarker.getPosition()
  var data = {
    type: $('.algo .active input').val(),
    source: source.lat() + ',' + source.lng(),
    dest: dest.lat() + ',' + dest.lng(),
    bidirectional: $('.bidirection .btn').hasClass('active'),
    epsilon: $('#epsilon input').val(),
    heuristic: $('#heuristic-type input:checked').val()
  }
  $.ajax('/animation', {
    type: 'GET',
    data: data,
    dataType: 'json'
  })
    .done(function(d) {
      console.log(d)
      drawAnimation(
        d['sequence'],
        d['coords'],
        d['path'],
        drawSpeed || getDrawSpeed()
      )
    })
    .fail(function(a, b, c) {
      console.log(a, b, c)
    })
    .always(function() {
      loading.end()
    })
}

function getDrawSpeed() {
  var speedText = $('.speed .active input').val()
  return drawSpeeds[speedText]
}

/*
 * Arguments:
 *  sequence -- a list of line segments [[startLatLon] --> [endLatLon]]
 *  nodeCoords -- a dictionary of node coordinates
 *  bestPath -- the shortest path found: list of [lat, lon]
 *  drawSpeed -- the approximate wait time between drawing each segment
 */
function drawAnimation(sequence, nodeCoords, bestPath, drawSpeed) {
  var curWait = 0
  var animationID = (curAnimationID = uuid())

  for (var i = 0, seqLen = sequence.length; i < seqLen; ++i) {
    var node = sequence[i][0],
      edges = sequence[i][1]
    for (var k = 0; k < edges.length; ++k) {
      if (i < seqLen / 2) {
        var color = 'rgba(' + ~~((255 * 2 * i) / seqLen) + ',255,0,1)'
      } else {
        var color = 'rgba(255,' + 2 * ~~(255 - (255 * i) / seqLen) + ',0,1)'
      }
      // var color = "rgba(255, 0, 0, .8)";
      delayedDrawSegment(
        node,
        edges[k],
        nodeCoords,
        animationID,
        color,
        curWait
      )
      curWait += drawSpeed
    }
  }
  plines.timeouts.push(
    setTimeout(function() {
      if (animationID === curAnimationID) {
        drawBestPath(bestPath)
      }
    }, curWait)
  )
}

function delayedDrawSegment(node, edge, nodeCoords, animationID, color, delay) {
  var draw = function() {
    if (animationID === curAnimationID) {
      drawSegment(node, edge, nodeCoords, color)
    }
  }
  if (delay > 0) {
    plines.timeouts.push(setTimeout(draw, delay))
  } else {
    draw()
  }
}

/*
 * The main drawing function for the expanding graph search.
 *
 * Arguments:
 *  node -- the ID of the node to draw to
 *  edge -- the ID of the edge to draw to
 *  nodeCoords -- a dictionary of node coordinates by ID
 */
function drawSegment(nodeID, edgeID, nodeCoords, color) {
  var path = [createGLL(nodeCoords[nodeID]), createGLL(nodeCoords[edgeID])]
  var polyline = createPolyline(path, color, 2)
  polyline.setMap(map)
  plines.list.push(polyline)
  if (edgeID in predList) {
    predList[edgeID].setMap(null)
    predList[edgeID] = null
  }
  predList[edgeID] = polyline
}

/*
 * Draws the shortest path found by the algorithm
 */
function drawBestPath(path) {
  var googleLLPath = []
  for (var i = 0; i < path.length; ++i) {
    googleLLPath.push(createGLL(path[i]))
  }
  var polyline = createPolyline(googleLLPath, '#000', 2, 100)
  polyline.setMap(map)
  plines.list.push(polyline)
}

/*
 * Draws green start and red end marker from provided [lat, lon]
 */
function setMarkers(source, dest) {
  sMarker = new google.maps.Marker({
    icon: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
    position: createGLL(source),
    map: map,
    title: 'Start',
    draggable: true
  })
  eMarker = new google.maps.Marker({
    icon: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
    position: createGLL(dest),
    map: map,
    title: 'End',
    draggable: true
  })
}

function customMarkerIcon(color) {
  var pinImage = new google.maps.MarkerImage(
    'http://chart.apis.google.com/chart?chst=d_map_pin_letter&chld=%E2%80%A2|' +
      color,
    new google.maps.Size(21, 34),
    new google.maps.Point(0, 0),
    new google.maps.Point(10, 34)
  )
  return pinImage
}

function resetMap() {
  for (var i = 0; i < plines.timeouts.length; ++i) {
    clearTimeout(plines.timeouts[i])
  }
  for (i = 0; i < plines.list.length; ++i) {
    plines.list[i].setMap(null)
  }
  plines.list = []
  plines.timeouts = []
  predList = {}
}

function createPolyline(path, color, size, zIndex) {
  return new google.maps.Polyline({
    path: path,
    strokeColor: color,
    strokeWeight: size,
    zIndex: zIndex
  })
}

function toggleBidirectional(elem) {
  if ($(elem).hasClass('active')) {
    $(elem).text('Bidirectional OFF')
  } else {
    $(elem).text('Bidirectional ON')
  }
}

function createGLL(p) {
  return new google.maps.LatLng(p[0], p[1])
}

function initialize() {
  initButtons()
  initHelp()
}

function initHelp() {
  var algoText =
    "Choose between three algorithms:<br>\
          -A* search algorithm  <br>\
          -Dijkstra's algorithm <br>\
          -ALT: A* Landmark Triangle Inequality"
  $('.algo-help').popover({
    content: algoText,
    html: 'right',
    trigger: 'hover'
  })

  var optionText =
    "The 'Bidirectional' toggle controls whether or not the search is   \
            performed from both the origin and destination simultaneously. Note that my  \
            current bidirectional algorithms don't have optimal bounds on the path length. \
            <br><br> \
            Heuristic weight multiplies the A* and ALT heuristics by a constant\
            factor, epsilon. Although this may cause routing to scan fewer     \
            vertices, the length of the path found will now be bounded by (optimal path len) * epsilon."
  $('.option-help').popover({
    content: optionText,
    html: 'right',
    trigger: 'hover'
  })

  var heurText =
    "Choose between three heuristics:<br>\
          -Euclidean: straight line distance <br>\
          -Manhattan: 'Taxicab' distance <br>\
          -Octile: Manhattan w/ diagonal movement"
  $('.heur-help').popover({
    content: heurText,
    html: 'right',
    trigger: 'hover'
  })
}

function initButtons() {
  // bidirectional toggle button
  $('.bidirection .btn').click(function() {
    toggleBidirectional($(this))
  })

  $('#go-button').click(function() {
    resetMap()
    startAnimation()
    loading.start()
  })
}

var loading = {
  start: function() {
    $('#go-button').button('loading')
    $('.map-loading-overlay').fadeIn(100)
  },
  end: function() {
    $('#go-button').button('reset')
    $('.map-loading-overlay').fadeOut(100)
  }
}

function initializeMap() {
  var mapOptions = {
    center: createGLL(CENTER),
    zoom: 15,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    disableDefaultUI: true
  }
  map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions)
  setMarkers(DEFAULT_SOURCE, DEFAULT_DEST)

  // run a demonstration graph search
  setTimeout(function() {
    startAnimation(18)
  }, 1000)
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

google.maps.event.addDomListener(window, 'load', initializeMap)
initialize()
