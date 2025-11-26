<?php
/**
 * Plugin Name: PrompVerse
 * Description: Gestor y organizador de prompts multiusuario para WordPress.
 * Version: 1.0.0
 * Author: PrompVerse
 * License: MIT
 * Text Domain: prompverse
 *
 * @package PrompVerse
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'PrompVerse_Plugin' ) ) {

	final class PrompVerse_Plugin {

		/**
		 * Singleton instance.
		 *
		 * @var PrompVerse_Plugin|null
		 */
		private static $instance = null;

		/**
		 * Plugin slug.
		 *
		 * @var string
		 */
		private $slug = 'prompverse';

		/**
		 * Bootstrap plugin.
		 */
		private function __construct() {
			$this->define_constants();
			$this->load_dependencies();

			add_action( 'init', [ $this, 'register_shortcode' ] );
			add_action( 'wp_enqueue_scripts', [ $this, 'register_assets' ] );
			add_action( 'rest_api_init', [ $this, 'register_routes' ] );
		}

		/**
		 * Retrieve singleton instance.
		 *
		 * @return PrompVerse_Plugin
		 */
		public static function instance() {
			if ( null === self::$instance ) {
				self::$instance = new self();
			}

			return self::$instance;
		}

		/**
		 * Define plugin constants.
		 *
		 * @return void
		 */
		private function define_constants() {
			if ( ! defined( 'PROMPVERSE_VERSION' ) ) {
				define( 'PROMPVERSE_VERSION', '1.0.0' );
			}

			if ( ! defined( 'PROMPVERSE_PATH' ) ) {
				define( 'PROMPVERSE_PATH', plugin_dir_path( __FILE__ ) );
			}

			if ( ! defined( 'PROMPVERSE_URL' ) ) {
				define( 'PROMPVERSE_URL', plugin_dir_url( __FILE__ ) );
			}
		}

		/**
		 * Load PHP dependencies.
		 *
		 * @return void
		 */
		private function load_dependencies() {
			require_once PROMPVERSE_PATH . '/includes/class-prompverse-rest.php';
		}

		/**
		 * Register the [prompverse] shortcode.
		 *
		 * @return void
		 */
		public function register_shortcode() {
			add_shortcode( 'prompverse', [ $this, 'render_shortcode' ] );
		}

		/**
		 * Register JavaScript and CSS assets.
		 *
		 * @return void
		 */
		public function register_assets() {
			wp_register_script(
				$this->slug,
				PROMPVERSE_URL . 'assets/js/prompverse.js',
				[],
				PROMPVERSE_VERSION,
				true
			);

			$settings = [
				'restUrl'    => esc_url_raw( rest_url( 'prompverse/v1/' ) ),
				'nonce'      => wp_create_nonce( 'wp_rest' ),
				'isLoggedIn' => is_user_logged_in(),
				'user'       => is_user_logged_in()
					? [
						'id'       => get_current_user_id(),
						'name'     => wp_get_current_user()->display_name,
						'email'    => wp_get_current_user()->user_email,
					]
					: null,
				'stylesUrl'  => esc_url_raw( PROMPVERSE_URL . 'assets/css/prompverse.css' ),
			];

			wp_localize_script( $this->slug, 'PrompVerseSettings', $settings );
			wp_script_add_data( $this->slug, 'type', 'module' );
		}

		/**
		 * Render shortcode output.
		 *
		 * @return string
		 */
		public function render_shortcode() {
			wp_enqueue_script( $this->slug );

			ob_start();
			?>
			<div class="prompverse-app-wrapper">
				<div id="prompverse-app" class="prompverse-app-container">
					<div class="loading-state"><?php esc_html_e( 'Cargando PrompVerse...', 'prompverse' ); ?></div>
				</div>
			</div>
			<?php

			return ob_get_clean();
		}

		/**
		 * Register REST routes.
		 *
		 * @return void
		 */
		public function register_routes() {
			PrompVerse_REST::register_routes();
		}
	}
}

PrompVerse_Plugin::instance();
