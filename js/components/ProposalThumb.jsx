import PropTypes from 'prop-types';
import React from 'react';
import { Link } from 'react-router-dom';

import GeoJsonMap from './GeoJsonMap.jsx';

const ProposalThumb = ({
	number,
	title,
	projectMetadata,
	mapPath,
	fetchJSON
}) => {

	let link = `/${ projectMetadata.owner.login }/${ projectMetadata.name }/${ number }`;
	
	return (
		<Link to={ link }>
			<figure className='proposal-thumb'>
				<GeoJsonMap
					path={ mapPath }
					fetchJSON={ fetchJSON }
				/>
				<figcaption>{ title }</figcaption>
			</figure>
		</Link>
	);

};

ProposalThumb.propTypes = {
	number: PropTypes.number.isRequired,
	title: PropTypes.string.isRequired,
	projectMetadata: PropTypes.shape({
		owner: PropTypes.shape({
			login: PropTypes.string
		}),
		name: PropTypes.string
	}).isRequired,
	mapPath: PropTypes.string.isRequired,
	fetchJSON: PropTypes.func.isRequired
};

export default ProposalThumb;