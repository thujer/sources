<?php

    /**
     *  +----------------------------------------------------------+
     *  |   Class Module                                           |
     *  |   Version 1.03.110802                                    |
     *  |   Author: Tomas Hujer (c) 2011                           |
     *  +----------------------------------------------------------+
     *
     * History
     * -------------------------------------------------------------
     * 1.03.110802 - Přidání automatické vytvoření instance db_managera
     *               pokud je zadána cesta k definičnímu souboru sql
     *               jako 2. parametr konstruktoru
     * 
     *             - automatická asociace filteru $this->parent['custom_join'],
     *               pokud je splněna předchozí podmínka a hodnoty filteru 
     *               přítomné v session registeru
     *               
     */

    if(!defined('RUNTIME_TEST'))
        die('Unauthorized access !');

    class module
    {
        var $module_dir = null;
        var $entry_point = null;
        var $class_name = null;

        public function __construct($module_id, $sql_config_file = null)
        {
            global $screen;
            
            $this->action    = request::get_text('action', 'REQUEST');
            $this->module_id = request::get_text('id', 'REQUEST');
            $this->record_id = self::get_cid($this->module_id);
            
            db_manager::define_positions_map('single');

            $this->parent = request::get_var('parent', 'REQUEST');
            if(!empty($this->parent))
                $this->parent = request::get_register_var($this->parent, 'parent');
            
            $this->module_dir = 'modules'.DS.'mod_'.$module_id.DS;
            $this->entry_point = $this->module_dir.'mod_'.$module_id.'.php';
            $this->class_name = 'mod_'.$module_id;

            language::load_language_file('module');

            $lang_file = $this->module_dir.'lang'.DS.language::get_language().'.php';
            if(file_exists($lang_file))
            {
                include $lang_file;
            }
            else
                message::add(message::create('msg_error', TEXT_CANNOT_LOAD.' "'.$lang_file.'" !', '<br />'.__FILE__.', line '.__LINE__), 'core');

            // If defined SQL configuration file, create instance of database manager
            if(!empty($sql_config_file))
            {
                if(file_exists($sql_config_file))
                {
                    $this->sql_file   = $sql_config_file;
                    $this->db_man = new db_manager($this->sql_file);

                    // Pripoj do sql upravy sql prikazu
                    if($this->parent['custom_join'])
                        $this->db_man->set_custom_join($this->parent['custom_join']);
                }
                else
                {
                    message::add(message::create('msg_error', TEXT_MODULE_SQL_CONFIG_FILE_NOT_FOUND.': '.$sql_config_file));
                }
            }

            // Load default CSS file if exists
            $css_file = $this->module_dir.'styles'.DS.'style.css';
            if(file_exists($css_file))
                css::add('..'.DS.$css_file);

            // Load default Script file if exists
            $script_file = $this->module_dir.'scripts'.DS.'script.js';
            if(file_exists($script_file))
                javascript::add('module_'.$module_id, '..'.DS.$script_file);

        }

        // --------------------------------------------------------------------------------------
        //! Get modules ID's from task value
        /*!
            @param $task Task value
        */
        // --------------------------------------------------------------------------------------
        static function get_modules_from_task($task)
        {
            global $db;

            if($db->connect())
            {
                // Get all modules assigned with task
                $query = ' SELECT m.name,'.LN
                        .'        m.permission,'.LN
                        .'        m.title'.LN
                        .' FROM '.CONFIG_DB_PREFIX.'modules_task AS mt'.LN
                        .LN
                        .' LEFT JOIN '.CONFIG_DB_PREFIX.'modules AS m'.LN
                        .'   ON mt.id_module = m.id'.LN
                        .LN
                        .' WHERE'.LN
                        .'   mt.id_task=('.LN
                        .'     SELECT t.id'.LN
                        .'     FROM '.CONFIG_DB_PREFIX.'tasks AS t'.LN
                        ."     WHERE t.name = '".$task."'".LN
                        .'   )'.LN
                ;

                $db->set_query($query);
                $rows = $db->load_assoc_list();

                return($rows);
            }
        }


        // --------------------------------------------------------------------------------------
        //! Get modules ID's from task value
        /*!
            @param $task        Task value
            @param $position    Get modules by this position
        */
        // --------------------------------------------------------------------------------------
        static function get_modules_from_task_position($task, $position)
        {
            global $db;

            if($db->connect())
            {
                $user = login::get_user();
                
                // Get all modules assigned with task
                $query = ' SELECT m.name,'.LN
                        .'        m.permission,'.LN
                        .'        m.title'.LN
                        .' FROM '.CONFIG_DB_PREFIX.'modules_task AS mt'.LN
                        .LN
                        .' LEFT JOIN '.CONFIG_DB_PREFIX.'modules AS m'.LN
                        .'   ON mt.id_module = m.id'.LN
                        .LN
                        .' WHERE'.LN
                        .'   mt.id_task=('.LN
                        .'     SELECT t.id'.LN
                        .'     FROM '.CONFIG_DB_PREFIX.'tasks AS t'.LN
                        ."     WHERE t.name = '$task' AND".LN
                        ."           m.position = '$position' AND".LN
                        ."           m.published = '1' AND".LN
                        ."           m.permission <= '".(int)$user->level."'".LN
                        .'     ORDER BY m.ordering'.LN
                        .'   )'.LN
                ;
                
                $db->set_query($query);
                $rows = $db->load_assoc_list();
                
                return($rows);
            }
        }


        // --------------------------------------------------------------------------------------
        //! Get translated module caption
        /*!
            @param $module_name Module name to get caption
        */
        // --------------------------------------------------------------------------------------
        static public function get_caption($module_name)
        {
            language::load_language_file('modules');            // Load modules names
            
            $caption = defined($module_name)?constant($module_name):$module_name;   // Translate caption if defined translation
            
            return($caption);
        }


        // --------------------------------------------------------------------------------------
        //! Module template rendering
        /*!
            @param $title       Module title
            @param $data_array  SQL configuration array
            @param $template    template file name
        */
        // --------------------------------------------------------------------------------------
        function render_module_template($title, $data_array, $template)
        {
            global $screen;

            $template_file = $css_file = $this->module_dir.'tmpl'.DS.$template.'.php';
            if(file_exists($template_file))
            {
                if(is_array($data_array))
                {
                    $this->joined  = $data_array['joined'];      // Add joined data
                    $this->options = $data_array['options'];     // Add select data

                    foreach($data_array['items'] as $key => $item)
                    {
                        $this->$key = new stdClass();
                        
                        $this->$key->name  = $key;
                        $this->$key->label = $item['caption'];
                        
                        foreach($item as $value_name => $assoc)
                            $this->$key->$value_name = $assoc;
                    }
                    
                    ob_start();
                    include $template_file;
                    $html .= ob_get_contents();
                    ob_end_clean();
                }
                else
                    message::add(message::create('msg_error', __('Error').': '.__('Empty result'), '<br />'.__FILE__.', line '.__LINE__), 'core');
            }
            else
                message::add(message::create('msg_error', TEXT_CANT_LOAD_MODULE_TEMPLATE.': '.$template_file, __FILE__.__LINE__), 'core');

            return $html;
        }


        // --------------------------------------------------------------------------------------
        //! Module template rendering (list type)
        /*!
            @param $title       Module title
            @param $data_array  SQL configuration array
            @param $template    template file name
        */
        // --------------------------------------------------------------------------------------
        function render_module_template_list($title, $data_array, $template)
        {
            global $screen;

            $template_file = $css_file = $this->module_dir.'tmpl'.DS.$template.'.php';
            if(file_exists($template_file))
            {
                if(is_array($data_array))
                {
                    $this->headers = $data_array['headers'];
                    $this->items   = $data_array['list'];
                    $this->columns = $data_array['columns_list'];
                    
                    $this->value_type = array();
                    foreach($this->columns as $column)
                    {
                        $this->value_type[$column]    = $data_array['items'][$column]['type'];
                        $this->value_localize[$column] = $data_array['items'][$column]['localize'];
                    }

                    $this->pagination = $data_array['pagination'];

                    ob_start();
                    include $template_file;
                    $html .= ob_get_contents();
                    ob_end_clean();
                }
                else
                    $html .= __('Error').': '.__('Empty result').'<br />'.__FILE__.', line '.__LINE__;
            }
            else
                $html .= TEXT_CANT_LOAD_MODULE_TEMPLATE.'<br />'.$template_file;

            return $html;
        }


        // --------------------------------------------------------------------------------------
        //! Module template rendering (Find type)
        /*!
            @param $title       Module title
            @param $data_array  SQL configuration array
            @param $template    template file name
        */
        // --------------------------------------------------------------------------------------
        function render_module_template_find($title, $data_array, $template)
        {
            global $screen;

            $template_file = $css_file = $this->module_dir.'tmpl'.DS.$template.'.php';
            if(file_exists($template_file))
            {
                if(is_array($data_array))
                {
                    $this->headers = $data_array['headers'];
                    $this->items   = $data_array['items'];
                    $this->columns = $data_array['columns_list'];

                    ob_start();
                    include $template_file;
                    $html .= ob_get_contents();
                    ob_end_clean();
                }
                else
                    $html .= __('Error').': '.__('Empty result').'<br />'.__FILE__.', line '.__LINE__;
            }
            else
                $html .= TEXT_CANT_LOAD_MODULE_TEMPLATE.'<br />'.$template_file;

            return $html;
        }


        // --------------------------------------------------------------------------------------
        //! Search modules directory and get modules list
        // --------------------------------------------------------------------------------------
        public static function search_list()
        {
            $modules = scandir('modules');
            
            $key = array_search('.', $modules);
            if(isset($key))
                unset($modules[$key]);
            
            $key = array_search('..', $modules);
            if(isset($key))
                unset($modules[$key]);
            
            return($modules);
        }

        
        // --------------------------------------------------------------------------------------
        //! Get selected records IDs
        /*!
            $param $module_id Module ID (if multiple lists showed)
        */
        // --------------------------------------------------------------------------------------
        static public function get_cid($module_id)
        {
            $cid = null;
            
            if(empty($cid))
                $cid = request::get_var('cid', 'REQUEST');
            
            if(empty($cid))
                $cid = request::get_var($module_id.'_cid', 'REQUEST');
            
            if(empty($cid))
                $cid = request::get_var('index',  'REQUEST', null);
            
            return($cid);
        }

     
    }
