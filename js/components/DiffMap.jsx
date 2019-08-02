import PropTypes from 'prop-types';
import React from 'react';
import {Map, TileLayer} from 'react-leaflet';
import leaflet from 'leaflet';
import jsts from 'jsts';

import appConfig from '../../static/appConfig.json';

// TODO: `react-leaflet` bump broke inheritance in this module.
// Fix and uncomment.
// import GeoJsonUpdatable from './GeoJsonUpdatable.jsx';

class DiffMap extends React.Component {
    constructor (props) {
        super(props);
        this.state = {};
    }

    static propTypes = {
		path1: PropTypes.string.isRequired,
		path2: PropTypes.string.isRequired,
		fetchJSON: PropTypes.func.isRequired,
		mapOptions: PropTypes.object
	}

    componentDidMount () {

		this.calculateGeometry(this.props);

	}

    UNSAFE_componentWillReceiveProps (nextProps) {

		// only recalculate geometry if we have a new path
		if (this.props.path1 !== nextProps.path1 || this.props.path2 !== nextProps.path2) {
			this.calculateGeometry(nextProps);
		}

	}

    shouldComponentUpdate (nextProps, nextState) {

		return this.state !== nextState;

	}

    calculateGeometry ({ path1, path2, fetchJSON }) {

		Promise.all([
			fetchJSON(path1),
			fetchJSON(path2)
		])
		.then(

			responses => {
				
				let reader = new jsts.io.GeoJSONReader(),
					p1 = reader.read(responses[0]),
					p2 = reader.read(responses[1]),
					unionP1,
					unionP2,
					diff,
					intersection,
					startTime = performance.now();

				console.info(`comparing ${ p1.features.length } previous districts against ${ p2.features.length } proposed districts...`);

				try {

					// TODO: this unioning seems necessary to perform JSTS operations between the two GeoJSON objects,
					// but causes boundaries between features to be erased. Find a better solution.
					unionP1 = p1.features.reduce((acc, f, i) => {
						if (i === 0) return f.geometry;
						if (acc.factory) return acc.union(f.geometry);
						return acc.geometry.union(f.geometry);
					});
					console.info(`union one complete in ${ ((performance.now() - startTime) / 1000).toFixed(3) }s`);
					startTime = performance.now();

					unionP2 = p2.features.reduce((acc, f, i) => {
						if (i === 0) return f.geometry;
						if (acc.factory) return acc.union(f.geometry);
						return acc.geometry.union(f.geometry);
					});
					console.info(`union two complete in ${ ((performance.now() - startTime) / 1000).toFixed(3) }s`);
					startTime = performance.now();

				} catch (error) {
					throw new Error(`Could not parse GeoJSON from ${ path1 } and ${ path2 }: ${ error.message }`);
				}

				try {

					// BUG: if one of the two GeoJSON objects has multiple features and the other has only one feature,
					// these operations will fail. How to work around / fix this?
					diff = {
						type: 'Feature',
						properties: {},
						geometry: new jsts.io.GeoJSONWriter().write(unionP1.symDifference(unionP2))
					};
					console.info(`diff complete in ${ ((performance.now() - startTime) / 1000).toFixed(3) }s`);
					startTime = performance.now();

					intersection = {
						type: 'Feature',
						properties: {},
						geometry: new jsts.io.GeoJSONWriter().write(unionP1.intersection(unionP2))
					};
					console.info(`intersection complete in ${ ((performance.now() - startTime) / 1000).toFixed(3) }s`);
					startTime = performance.now();

				} catch (error) {
					throw new Error(`Could not calculate diff from ${ path1 } and ${ path2 }: ${ error.message }`);
				}

				this.setState({
					diffError: null,
					base: p1,
					head: p2,
					diff,
					intersection
				});
			},

			error => {
				throw new Error(`Could not fetch/read GeoJSON from ${ path1 } and ${ path2 }: ${ error.message }`);
			}

		)
		.catch(error => {

			this.setState({
				diffError: error.message
			});

		});

	}

    render () {

		// TODO: render base/head as necessary to display original, non-unioned feature boundaries

		let body = '';

		if (this.state.diff) {

			let mapConfig = {
				zoom: 8,
				center: [0, 0],
				zoomSnap: 0,
				...(this.props.mapOptions || {})
			};

			body = (
				<Map { ...mapConfig } ref='leafletMap' className='map-container' onLayeradd={ this.onMapLayerAdd }>
					{ this.renderTileLayers() }
					{/*
					<GeoJsonUpdatable className='diff' data={ this.state.diff } />
					<GeoJsonUpdatable className='intersection' data={ this.state.intersection } />
					*/}
				</Map>
			);

		} else if (this.state.diffError) {

			body = (
				<div className='diff-error'>
					{ this.state.diffError }
				</div>
			);

		} else {

			body = (
				<div className='is-processing'>
					Processing...
				</div>
			);
		}

		return (
			<div className='diff-map'>
				{ body }
			</div>
		);

	}

    renderTileLayers () {

		let layers = [];

		if (appConfig.map.tileLayers) {
			layers = layers.concat(appConfig.map.tileLayers.map((item, i) => {
				return (
					<TileLayer
						key={ 'tile-layer-' + i }
						url={ item.url }
					/>
				);
			}));
		}

		return layers;

	}

    onMapLayerAdd = event => {

		if (event.layer.feature) {

			// TODO: really should be fitting bounds to the union, actually...
			//		 or just manually adding diff + intersection bounds together and using the resulting bounds rect
			if (event.layer._options && event.layer._options.className === 'intersection') {
				// fit map bounds to GeoJSON layer once it loads
				this.refs.leafletMap.leafletElement.fitBounds(event.layer.getBounds());
			}

		}

	};
}

export default DiffMap;
