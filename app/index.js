import * as d3 from 'd3'
import * as topojson from 'topojson'

const width = 600
const height = 500

const projection = d3.geoOrthographic()
    .scale(220)
    .rotate([0, 0])
    .translate([width / 2, height / 2])
    .clipAngle(90)

const path = d3.geoPath()
    .projection(projection)

const svg = d3.select('body')
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

        const countryMap = countryData.reduce((map, data) => Object.assign(map, {[data.name]: data}), {})

        let lands = svg.selectAll('path.land')
            .data(countries)
            .enter()
            .append('path')
            .attr('class', 'land')
            .attr('d', path)
        
        let cts = svg.selectAll('path.city')
            .data(citiesG)
            .enter()
            .append('path')
            .attr('class', 'city')
            .attr('d', path)

        const bratislava = citiesG.find(c => c.id === 'Bratislava')
        const otherCities = citiesG.filter(c => c.id !== 'Bratislava')

        const lines = otherCities.map(c => lineStringFeature(bratislava.geometry.coordinates, c.geometry.coordinates))

        let lns = svg.selectAll('path.route')
            .data(lines)
            .enter()
            .append('path')
            .attr('class', 'route')
            .attr('d', path)
        
        let sensitivity = 0.1
        svg.call(d3.drag()
            .subject(() => {
                const rotate = projection.rotate()
                return {
                    x: rotate[0] / sensitivity,
                    y: -rotate[1] / sensitivity
                }
            })
            .on('drag', () => {
                const rotate = projection.rotate()
                projection.rotate([
                    d3.event.x * sensitivity,
                    -d3.event.y * sensitivity,
                    rotate[2]])
                
                svg.selectAll('path').attr('d', path)
            }))

        



        function lineStringFeature (start, end) {
            return {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [start, end]
                }
            }
        }
        
        transitionTo('Slovakia')
        
        function transitionTo (countryName) {
            const country = countries.find(c => c.id === parseInt(countryMap[countryName].id))
            const point = d3.geoCentroid(country)

            d3.transition()
                .duration(2500)
                .tween('rotate', () => {
                    const r = d3.interpolate(projection.rotate(), [-point[0], -point[1]])
                    const s = d3.interpolate(projection.scale(), 500)
                    return function (t) {
                        projection.rotate(r(t))
                        projection.scale(s(t))
                        svg.selectAll('path')
                            .attr('d', path)
                    }
                })
        }
    })