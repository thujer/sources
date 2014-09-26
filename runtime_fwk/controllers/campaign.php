<?

/**
 *  Class Campaign manage                                 
 *  @version 1.01.130523                                  
 *  @author  Tomas Hujer                                  
 */
class campaign {

    /**
     * List all categories
     * @global object $db
     * @return html template
     */
    public static function categoryListAction() {
        global $db;

        javascript::add('knockout', "scripts/knockout.js", 'start');
        plugins::load('datetimepicker');
        
        $b_ajax = request::get_var('b_ajax');

        if(request::register_value_exists('campaign', 'nl_id_shop'))
            $nl_id_shop = request::get_register_var ('campaign', 'nl_id_shop');
        else
            $nl_id_shop = request::get_var('nl_id_shop', 'REQUEST', 1);
        
        require_once CONFIG_APP_CONTROLLERS . '/helper.php';

        if (!login::is_logged_in())
            return "Prosím přihlaste se." . BR;

        // Get campaign list (RESULT1 = campaign list, RESULT2 = campaign categories)
        $o_campaign = $db->call_stored_proc('app_get_shop_campaign', array(
            'inl_id_shop' => $nl_id_shop,
            'inl_id_campaign' => 0
        ));
        
        foreach($o_campaign as $a_campaign)
            if($a_campaign['error'])
                $a_message[] = $a_campaign['query'].': '.$a_campaign['error'];
        
        // Get shop list
        $o_shop = $db->call_stored_proc('app_get_shop', array(
        ));
        foreach($o_shop as $a_result) 
            if($a_result['error'])
                $a_message[] = $a_result['query'].': '.$a_result['error'];
            
        // Change result array index by id_shop
        foreach($o_shop[0]['result'] as $o_result) {
            $a_shop[$o_result->id_shop] = $o_result;            
        }
        
        $nl_id_campaign = request::get_var('nl_id_campaign');
        
        tokens::generate('TOKEN_CAMPAIGN_CATEGORY_CHANGE');
        
        // Vytvoření instance tohoto objektu
        $s_template_class = __CLASS__;
        $o_template = new $s_template_class();
        $o_template->bind(array(
            'a_tree_category' => json_encode(prepare_js(self::getCategoryAction($nl_id_shop))),
            
            'a_shop' => $a_shop,
            'nl_id_shop' => $nl_id_shop,
            
            'a_campaign' => $o_campaign[0]['result'],
            'nl_id_campaign' => $nl_id_campaign,
            
            'a_message' => $a_message,
            
            's_token' => tokens::get_value('TOKEN_CAMPAIGN_CATEGORY_CHANGE')
        ));

        $html = $o_template->render_view('category-table');
        
        if($b_ajax)
            layout::disable();

        return $html;
    }
    
    
    /**
     * List all capaigns
     * @global object $db
     * @return html template
     */
    public static function campaignListAction() {
        global $db;

        if (login::is_logged_in()) {
            
            $b_ajax = request::get_var('b_ajax');
            $nl_id_shop = request::get_var('nl_id_shop', 'REQUEST', 0);
            
            if($nl_id_shop) {

                // Get campaign list (RESULT1 = campaign list, RESULT2 = campaign categories)
                $o_campaign = $db->call_stored_proc('app_get_shop_campaign', array(
                    'inl_id_shop' => $nl_id_shop,
                    'inl_id_campaign' => 0
                ));

                foreach($o_campaign as $a_campaign)
                    if($a_campaign['error'])
                        $a_message[] = $a_campaign['query'].': '.$a_campaign['error'];
            }
            else
                $a_message[] = "Není uvedeno ID shopu." . BR;
        }
        else {
            $a_message[] = "Prosím přihlaste se." . BR;
        }
    
        // Vytvoření instance tohoto objektu
        $html = json_encode(array(
            'a_campaign'    => $o_campaign[0]['result'],
            'a_message'     => $a_message,
            's_token'       => tokens::get_value('TOKEN_CAMPAIGN_CATEGORY_CHANGE')
        ));

        if($b_ajax)
            layout::disable();

        return $html;
    }
    
    
    /**
     * Get categories by shop
     * @global object $db       Database object pointer
     * @param int $nl_id_shop   Shop ID
     * @return array
     */
    public static function getCategoryAction($nl_id_shop = 0) {
        global $db;
        
        if(empty($nl_id_shop))
            $nl_id_shop = request::get_var('nl_id_shop', 'REQUEST', 1);
        
        request::set_register_var('campaign', 'nl_id_shop', $nl_id_shop);
        
        $b_ajax = request::get_var('b_ajax');
        
        require_once CONFIG_APP_CONTROLLERS . '/helper.php';

        $o_result = $db->call_stored_proc('app_get_shop_category', array(
            'inl_id_shop' => $nl_id_shop,
            'inl_id_language' => language::get_language_id(),
            'inl_level_min' => 0,
            'is_image_postfix' => ''
        ));
        foreach($o_result as $a_result)
            if($a_result['error'])
                $a_message[] = $a_result['query'].': '.$a_result['error'];
        
        $maxLevel = 1;
        $currentLevel = -1;
        $map = array();
        $a_tree_category = array();
        $data = $o_result[0]['result'];
        
        // Check if images exists
        foreach($data as $o_item) {
            $img = CONFIG_SHOP_DIR."/img/".$o_item->image;
            
            if(!file_exists($img)) {
                $o_item->image = "not_found.png";
            }
        }
        
        do {
            $currentLevel++;

            if($data)
            foreach($data as $key => $row) {

                //tmp
                $row = (object) $row;

                //set max depth
                if ($row->level_depth > $maxLevel)
                    $maxLevel = $row->level_depth;

                //process only one level in one time
                if ($row->level_depth <> $currentLevel)
                    continue;

                //include parrent
                if (isset($map[$row->id_parent])) {
                    $map[$row->id_category] = $map[$row->id_parent];
                }

                //current path
                $map[$row->id_category][] = $row->id_category;
                $map[$row->id_category][] = 'childs';

                //prepare item to result
                $item = (array) $row;
                $item['childs'] = array();

                //not mapped - wrong data or root category
                if (!isset($map[$row->id_parent])) {
                    $a_tree_category[$row->id_category] = $item;

                    //set by path to its parent
                }
                else {
                    $leaf = &getChild($map[$row->id_parent], $a_tree_category);
                    $leaf[$row->id_category] = $item;
                }

                //remove processed item
                unset($data[$key]);
            }
        } while ($maxLevel > $currentLevel);


        if($b_ajax) {
            layout::disable();

            // Vytvoření instance tohoto objektu
          $aa = prepare_js($a_tree_category);
            return json_encode($aa[0]);

        }
        else
            return $a_tree_category;
    }


    /**
     * Store category
     */
    public static function categoryStoreAction() {
        
        global $db;
        
        if(tokens::check_token('TOKEN_CAMPAIGN_CATEGORY_CHANGE', 's_token')) {

            $o_campaign = $db->call_stored_proc('app_update_campaign_category', array(
                'inl_id_shop'       => request::get_var('nl_id_shop'),
                'inl_id_campaign'   => request::get_var('nl_id_campaign'),
                'inl_id_category'   => request::get_var('nl_id_category'),
                'inl_id_action'     => request::get_var('nl_id_action'),
            ));
            
            $a_status['s_message'] = $o_campaign['error'];
            $a_status['result'] = $o_campaign[0]['result'][0];
            
            echo json_encode($a_status);
        }
        
        layout::disable();
    }


    /**
     * Get info and details about campaign
     */
    public static function getCampaignCategoryAction() {
        global $db;
        
        $nl_id_shop = request::get_var('nl_id_shop');
        $nl_id_campaign = request::get_var('nl_id_campaign');
        
        $o_result = $db->call_stored_proc('app_get_campaign_category', array(
            'inl_id_shop' => $nl_id_shop,
            'inl_id_campaign' => $nl_id_campaign
        ));
        
        $o_result_campaign = $db->call_stored_proc('app_get_campaign_detail', array(
            'inl_id_shop' => $nl_id_shop,
            'inl_id_campaign' => $nl_id_campaign
        ));
        
        // Resort category to array
        foreach($o_result[0]['result'] as $o_category) {
            $a_category[] = $o_category->nl_id_category;
        }
        
        $o_campaign = $o_result_campaign[0]['result'][0];
        
        if(!empty($o_campaign)) {
            $o_campaign->dt_start = localize::sql2local($o_campaign->dt_start, 'datetime')?:'';
            $o_campaign->dt_end = localize::sql2local($o_campaign->dt_end, 'datetime')?:'';
        }
        
        echo json_encode(array(
            'a_category'    => $a_category,
            'o_campaign'    => $o_campaign
        ));
        
        layout::disable();
    }


    /**
     * Store campaign details
     */
    public static function updateAction() {
        
        global $db;
        
        define('_TOKEN_CAMPAIGN', 'TOKEN_CAMPAIGN_CATEGORY_CHANGE');
        
        if(tokens::check_token(_TOKEN_CAMPAIGN, 's_token')) {

            $o_campaign = $db->call_stored_proc('app_update_campaign', array(
                'inl_id_campaign'   => request::get_var('nl_id_campaign'),
                'inl_id_shop'       => request::get_var('nl_id_shop'),
                'inl_id_action'     => request::get_var('b_action'),
                'is_name'           => request::get_var('s_name'),
                'is_description'    => request::get_var('s_description'),
                'idt_start'         => localize::local2sql(request::get_var('dt_start'), 'datetime'),
                'idt_end'           => localize::local2sql(request::get_var('dt_end'), 'datetime'),
                'ib_active'         => request::get_var('b_active')
            ));
            
            $o_result['s_query']        = $o_campaign[0]['query'];
            $o_result['o_result']       = $o_campaign[0]['result'][0];

            if($o_campaign[0]['error'])
                $o_result['s_message'][]    = $o_campaign[0]['error'];
            
            
            $o_campaign_list = $db->call_stored_proc('app_get_shop_campaign', array(
                'inl_id_shop'       => request::get_var('nl_id_shop'),
                'inl_id_campaign'   => 0,
            ));

            if($o_campaign_list[0]['error'])
                $o_result['s_message'][]    = $o_campaign_list[0]['error'];
            
            $o_result['a_campaign_list'] = $o_campaign_list[0]['result'];
        }
        else {
            $o_result['s_message'][] = tokens::get_error_msg(_TOKEN_CAMPAIGN);
        }
        
        echo json_encode($o_result);
        
        layout::disable();
    }


    /**
     * Prepare data for template, store it into this object
     * @param $data array
     */
    public function bind($data) {
        if (!isset($this->template))
            $this->template = array();

        $this->template['language'] = language::get_language();

        if (is_array($data) || is_object($data))
            $this->template = $this->template + $data;
        else
            $this->template = $data;
    }


    /**
     * Generate html code
     * @param string $view View id
     * @param array $template Values passing to template
     * @return string Html code
     */
    public function render_view($view, $template = array()) {
        //html::show($template);

        if (!empty($template) && is_array($template))
            foreach($template as $key => $value) {
                $this->template[$key] = $value;
            }

        $template_file = CONFIG_APP_DIR . "/templates/" . __CLASS__ . "/$view.php";
        if (file_exists($template_file)) {

            $css_file = CONFIG_APP_DIR . "/templates/" . __CLASS__ . "/css/$view.css";
            if (file_exists($css_file))
                css::add($view, $css_file);

            $js_file = CONFIG_APP_DIR . "/templates/" . __CLASS__ . "/js/$view.js";
            if (file_exists($js_file))
                javascript::add($view, $js_file);

            ob_start();
            include $template_file;
            $html .= ob_get_contents();
            ob_end_clean();
        }
        else
            $html .= __("Template %s not found", $template_file) . ' !!!' . BR;

        return $html;
    }

}

