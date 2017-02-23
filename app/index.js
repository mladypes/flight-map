import * as d3 from 'd3'
import * as topojson from 'topojson'

import * as slider from 'nouislider'

const width = 600
const height = 500

slider.create(document.getElementById('slider-flight-length'), {
	start: [20, 80],
	connect: true,
	range: {
		'min': 0,
		'max': 100
	}
});

slider.create(document.getElementById('slider-temperature'), {
	start: [20, 80],
	connect: true,
	range: {
		'min': 0,
		'max': 100
	}
});

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

d3.queue()
    .defer(d3.json, 'data/world-110m.json')
    .defer(d3.tsv, 'data/world-110m-country-names.tsv')
    .defer(d3.json, 'data/citiesfilter.json')
    .await((error, world, countryData, cities) => {
        let countries = topojson.feature(world, world.objects.countries).features

        let citiesG = cities.features
        const bratislava = citiesG.find(c => c.id === 'Bratislava')
        const otherCities = citiesG.filter(c => c.id !== 'Bratislava')

        const countryMap = countryData.reduce((map, data) => Object.assign(map, {[data.name]: data}), {})

        let lands = svg.selectAll('path.land')
            .data(countries)
            .enter()
            .append('path')
            .attr('class', 'land')
            .attr('d', path)
        
        const lines = otherCities.map(c => lineStringFeature(bratislava.geometry.coordinates, c.geometry.coordinates))

        let lns = svg.selectAll('path.route')
            .data(lines)
            .enter()
            .append('path')
            .attr('class', 'route')
            .attr('d', path)
        
        let cts = svg.selectAll('path.city')
            .data(otherCities)
            .enter()
            .append('path')
            .attr('class', 'city')
            .attr('d', path)

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
        
        function addPlanes () {
            planes = svg.selectAll('.plane')
                .data(lns.nodes())
                .enter()
                .append('circle')
                .attr('r', 3)
                .attr('class', 'plane')
                .attr("transform", d => "translate(" + d.getPointAtLength(0).x + ',' + d.getPointAtLength(0).y + ")" )
        }

        function planesTransition() {
            planes
                .filter(function () {
                    return d3.active(this) === null
                })
                .transition()
                .duration(function () {
                    return 6000 + Math.random() * 6000
                })
                .attrTween('transform', function (d) {
                    return translateAlong(d)
                })
                .on('end', planesTransition)
        }

        function translateAlong (path) {
            const l = path.getTotalLength();
            
            return function (t) {
                const p = path.getPointAtLength(t * l);
                return "translate(" + p.x + "," + p.y + ")";
            };
            
        }
        
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
                    addPlanes();
                    planesTransition();
                })
        }
    })