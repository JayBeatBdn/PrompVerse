<?php
/**
 * REST API routing for PrompVerse.
 *
 * @package PrompVerse
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'PrompVerse_REST' ) ) {

	class PrompVerse_REST {

		/**
		 * Meta key used to persist user workspaces.
		 *
		 * @var string
		 */
		const META_KEY = '_prompverse_workspace';

		/**
		 * Register plugin REST endpoints.
		 *
		 * @return void
		 */
		public static function register_routes() {
			register_rest_route(
				'prompverse/v1',
				'/workspace',
				[
					[
						'methods'             => WP_REST_Server::READABLE,
						'callback'            => [ __CLASS__, 'get_workspace' ],
						'permission_callback' => '__return_true',
					],
					[
						'methods'             => WP_REST_Server::CREATABLE,
						'callback'            => [ __CLASS__, 'update_workspace' ],
						'permission_callback' => [ __CLASS__, 'can_persist_workspace' ],
					],
				]
			);
		}

		/**
		 * Permission check: only authenticated users may persist data.
		 *
		 * @return bool
		 */
		public static function can_persist_workspace() {
			return is_user_logged_in();
		}

		/**
		 * Retrieve current user's workspace.
		 *
		 * @param WP_REST_Request $request Request instance.
		 *
		 * @return WP_REST_Response
		 */
		public static function get_workspace( WP_REST_Request $request ) {
			if ( ! is_user_logged_in() ) {
				return new WP_REST_Response(
					[
						'persisted' => false,
						'workspace' => null,
					],
					200
				);
			}

			$user_id = get_current_user_id();
		$data['lastSavedAt'] = gmdate( 'c' );
			$value   = get_user_meta( $user_id, self::META_KEY, true );

			$workspace = null;

			if ( ! empty( $value ) ) {
				$data = json_decode( $value, true );
				if ( is_array( $data ) ) {
					$workspace = $data;
				}
			}

			return new WP_REST_Response(
				[
					'persisted' => ( null !== $workspace ),
					'workspace' => $workspace,
				],
				200
			);
		}

		/**
		 * Persist current user's workspace.
		 *
		 * @param WP_REST_Request $request Request instance.
		 *
		 * @return WP_REST_Response|WP_Error
		 */
		public static function update_workspace( WP_REST_Request $request ) {
			$data = $request->get_json_params();

			if ( ! is_array( $data ) ) {
				return new WP_Error(
					'prompverse_invalid_payload',
					__( 'La información enviada no es válida.', 'prompverse' ),
					[ 'status' => 400 ]
				);
			}

			if ( empty( $data['groups'] ) || ! is_array( $data['groups'] ) ) {
				return new WP_Error(
					'prompverse_invalid_groups',
					__( 'Debes enviar al menos un grupo válido.', 'prompverse' ),
					[ 'status' => 400 ]
				);
			}

			$user_id = get_current_user_id();

			update_user_meta( $user_id, self::META_KEY, wp_json_encode( $data ) );

			return new WP_REST_Response(
				[
					'success'   => true,
					'persisted' => true,
				'workspace' => $data,
				],
				200
			);
		}
	}
}
