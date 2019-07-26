import React from 'react';
import queryString from 'query-string';

import AppContext from '../context';
import auth from '../models/auth';


class Auth extends React.Component {
	static contextType = AppContext;

	constructor (props) {

		super(props);

	}

	UNSAFE_componentWillMount () {

		let { code, state } = queryString.parse(this.props.location.search),
			pathname = '/';
		console.log(">>>>> ", { code, state });

		if (state) {
			// technically, this is an incorrect use of OAuth2 state,
			// which is supposed to be used for additional security.
			// But it's also handy for maintaining state across redirects;
			// we use it here to redirect the user to the
			// page that initially requested the auth.
			pathname = decodeURIComponent(state);
		}

		auth.fetchAccessToken(code,
			() => {
				// on success
				this.props.history.push({
					pathname
				});
			},
			() => {
				// on error
				this.props.history.push({
					pathname: '/',
					state: { errorResponse: window.location.href }
				});
			}
		);

	}

	componentDidMount () {

		//

	}

	componentWillUnmount () {

		//

	}

	render () {

		return (
			<div className='auth-page'>
				<h1>Logging in...</h1>
			</div>
		);

	}

}

export default Auth;
