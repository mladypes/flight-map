import * as d3 from 'd3'
import * as topojson from 'topojson'

import * as slider from 'nouislider'

const width = 600
const height = 500

let lengthSlider;
let temperatureSlider;

const projection = d3.geoOrthographic()
    .scale(220)
    .rotate([0, 0])
    .translate([width / 2, height / 2])
    .clipAngle(90)

const path = d3.geoPath()
    .projection(projection)

const svg = d3.select('#earth-container')
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', `0 0 ${width} ${height}`)

svg.append('path')
    .datum({type: 'Sphere'})
    .attr('class', 'water')
    .attr('d', path)

function setupSliders (cities, updateCallback) {
    const temperatureRange = getValueRange(cities, c => c.properties.temperature)
    const flightLengthRange = getValueRange(cities, c => c.properties.flightDuration)
    console.log('temperature', temperatureRange)
    console.log('length', flightLengthRange)

    temperatureSlider = createSlider(document.getElementById('slider-temperature'), temperatureRange.min, temperatureRange.max)
    temperatureSlider.noUiSlider.on('change', updateCallback)
    lengthSlider = createSlider(document.getElementById('slider-flight-length'), flightLengthRange.min, flightLengthRange.max)
    lengthSlider.noUiSlider.on('change', updateCallback)
}

function createSlider (domElement, minValue, maxValue) {
    slider.create(domElement, {
        start: [minValue, maxValue],
        connect: true,
        range: {
            'min': minValue,
            'max': maxValue 
        },
        tooltips: true
    });

    return domElement
}

function getValueRange (objects, valueExtractor) {
    return objects.reduce((acc, o) => {
        const v = valueExtractor(o)
        const {min, max} = acc;
        return {
            min: v < min ? v : min,
            max: v > max ? v : max
        }
    }, {min: Infinity, max: -Infinity});
}

d3.queue()
    .defer(d3.json, 'data/world-110m.json')
    .defer(d3.tsv, 'data/world-110m-country-names.tsv')
    .defer(d3.json, 'data/citiesfilter.json')
    .await((error, world, countryData, cities) => {
        let countries = topojson.feature(world, world.objects.countries).features

        let citiesG = cities.features
        const bratislava = citiesG.find(c => c.id === 'Bratislava')
        const otherCities = citiesG.filter(c => c.id !== 'Bratislava')

        setupSliders(otherCities, () => {
            update(bratislava, otherCities, temperatureSlider.noUiSlider.get(), lengthSlider.noUiSlider.get())
        })
        

        const countryMap = countryData.reduce((map, data) => Object.assign(map, {[data.name]: data}), {})

        svg.selectAll('path.land')
            .data(countries)
            .enter()
            .append('path')
            .attr('class', 'land')
            .attr('d', path)
            .exit().remove()
        
        transitionTo('Slovakia')
        
        function transitionTo (countryName) {
            const country = countries.find(c => c.id === parseInt(countryMap[countryName].id))
            const point = d3.geoCentroid(country)

            d3.transition()
                .duration(2500)
                .tween('rotateAndZoom', () => {
                    const r = d3.interpolate(projection.rotate(), [-point[0], -point[1]])
                    const s = d3.interpolate(projection.scale(), 500)
                    return function (t) {
                        projection.rotate(r(t))
                        projection.scale(s(t))
                        svg.selectAll('path')
                            .attr('d', path)
                    }
                })
                .on('end', function () {
                    update(bratislava, otherCities, temperatureSlider.noUiSlider.get(), lengthSlider.noUiSlider.get())
                })
        }
    })

function update(start, destinations, temperatureRange, lengthRange) {
    const filteredDestinations = destinations.filter(v => {
        return (v.properties.temperature >= temperatureRange[0] && v.properties.temperature <= temperatureRange[1]) &&
            (v.properties.flightDuration >= lengthRange[0] && v.properties.flightDuration <= lengthRange[1])
    })

    const lines = filteredDestinations.map(c => lineStringFeature(start.geometry.coordinates, c.geometry.coordinates))
    

    let lns = svg.selectAll('path.route')
        .data(lines)

    lns.enter()
        .append('path')
        .attr('class', 'route')
        .attr('d', path)
    
    lns.exit()
        .remove()
    
    let cts = svg.selectAll('path.city')
        .data(filteredDestinations)

    cts.enter()
        .append('path')
        .attr('class', 'city')
        .attr('d', path)
    cts.exit()
        .remove()

    function lineStringFeature (start, end) {
        return {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [start, end]
            }
        }
    }

    let planes;
    addPlanes();
    
    function addPlanes () {
        planes = svg.selectAll('.plane')
            .data(lns.nodes())

        planes.enter()
            .append('circle')
            .attr('r', 3)
            .attr('class', 'plane')
            .attr("transform", d => "translate(" + d.getPointAtLength(0).x + ',' + d.getPointAtLength(0).y + ")" )

        planes.exit().remove()

        // planes.transition()
        //     .duration(function () {
        //         return 6000 + Math.random() * 6000
        //     })
        //     .attrTween('transform', function (d) {
        //         return translateAlong(d)
        //     })
    }

    function translateAlong (path) {
        const l = path.getTotalLength();
        
        return function (t) {
            const p = path.getPointAtLength(t * l);
            return "translate(" + p.x + "," + p.y + ")";
        };
        
    }
}