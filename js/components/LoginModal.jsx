import PropTypes from 'prop-types';
import React from 'react';
import Modal from 'react-modal';

Modal.setAppElement('#app');

/**
 * Modal with message and optional login/signup button
 */
export default class LoginModal extends React.Component {
    static propTypes = {
		title: PropTypes.string,
		message: PropTypes.string,
		buttonLabel: PropTypes.string,
		isOpen: PropTypes.bool,
		onClose: PropTypes.func
	}

    static defaultProps = {
		onClose: () => {}
	}

    constructor (props) {
        super(props);
        this.state = {};
    }

    UNSAFE_componentWillReceiveProps (nextProps) {

		if (nextProps.isOpen === true) {
			window.addEventListener('keydown', this.onKeyDown);
			// TODO: add modal overlay click handler to close
		} else if (nextProps.isOpen === false) {
			window.removeEventListener('keydown', this.onKeyDown);
			// TODO: remove modal overlay click handler to close
		}

		// NOTE: while `isOpen` is controlled by parent component for opening the modal,
		// it is transformed into local state here so that the modal has control over closing itself
		// and triggering the onRequestClose callback.
		// However, current state is preserved when the modal is remaining open.
		if (!nextProps.isOpen || !this.state.isOpen) {
			this.setState({
				isOpen: nextProps.isOpen
			});
		}

	}

    componentDidUpdate () {

		if (this.overlayClickHandlerInited || !this.state.isOpen) return;

		// Give modal overlay time to open
		setTimeout(() => {
			let overlay = document.querySelector('.login-modal-overlay');
			if (!overlay) return;

			overlay.addEventListener('click', this.onOverlayClicked.bind(this));
			this.overlayClickHandlerInited = true;
		}, 100);

	}

    onKeyDown = event => {

		switch (event.keyCode) {
			case 13:	// enter
				this.closeModal(true);
				break;
			case 27:	// escape
				this.closeModal(false);
				break;
		}

	};

    onOverlayClicked (event) {

		let overlay = document.querySelector('.add-item-modal-overlay')
		if (event.target === overlay) this.closeModal(false);
		
	}

    closeModal = confirmed => {

		this.props.onClose && this.props.onClose(confirmed);

	};

    render () {

		const {
			title,
			message
		} = this.props;

		return (
			<Modal
				isOpen={ this.state.isOpen }
				className='login-modal'
				overlayClassName='login-modal-overlay'
				contentLabel={ title || 'Login' }
			>
				<div>
					{ title ? <h2>{ title }</h2> : null }
					<p className='modal-desc' dangerouslySetInnerHTML={ { __html: message } }></p>
					<div className='button login' onClick={ () => this.closeModal(true) }>Log in / Sign up</div>
					<div className='button cancel' onClick={ () => this.closeModal(false) }>Continue</div>
				</div>
			</Modal>
		);
	}
}
