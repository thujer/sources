
<style>

  .textTop.big {
    font-size: 3.45vw;
  }

  .textTop.small {
    font-size: 2.00vw;
  }

  .textTop.bold {
    font-family: 'HelveticaNeueLTPro-Blk';
  }

  .textTop.normal {
    font-family: 'HelveticaNeueLTPro-Lt';
  }

  .text-top-container {
    margin-left: 10%;
    margin-top: 10%;
    line-height: 4.45vw;
  }

  @media screen and (max-width: 768px) {
    .v-carousel__controls {
      display: none !important;
    }

    .button-link-component {
      display: none !important;
    }
  }

</style>

<template>
      <v-carousel
          height="auto"
          width="100%"
          class=""
          interval="5000"
          loop="true"
      >
        <v-carousel-item
          v-for="(image, index) in topImageArray"
          :key="index"
          :src="image"
          cover
        >
        </v-carousel-item>

        <div
            class="text-left text-white position-absolute"
            style="left: 18%"
        >
            <BoxLoadingComponent v-if="loadingStatus.inProgress" />
            <BoxLoadingErrorComponent v-if="!loadingStatus.success" :error-text="loadingStatus.errorText" />

            <div
                class="text-top-container"
                v-if="loadingStatus.success"
            >
              <div
                  v-for="(item, index) in topTextArray.length"
                  :key="index"
                  class="textTop text-pre-wrap"
                  :class="topTextArray[index].s_class"
              >
                {{ topTextArray[index].s_text }}
              </div>
            </div>
        </div>

        <div
            v-if="buttonName"
            class="mt-5 position-absolute"
            style="left: 70%; top: 60%"
        >
          <ButtonLinkComponent :name="buttonName" :link="buttonLink" :target="buttonTarget" />
        </div>

      </v-carousel>
</template>

<script>
import { ref } from "vue"
import ButtonLinkComponent from "@/components/ButtonLink.vue";
import axios from 'axios'
import BoxLoadingErrorComponent from "@/components/BoxLoadingError.vue";
import BoxLoadingComponent from "@/components/BoxLoading.vue";

export default {
  name: "SlideShowComponent",

  components: {BoxLoadingComponent, BoxLoadingErrorComponent, ButtonLinkComponent},
  props: {
    imageSrc: Array,
    slug: String,

    buttonName: String,
    buttonLink: String,
    buttonTarget: String,
  },

   data() {
    return {
      topTextArray: [],

      topImageArray: ref([
        "/assets/slideshow/slide1.jpg",
        "/assets/slideshow/slide2.jpg",
        "/assets/slideshow/slide3.jpg",
        "/assets/slideshow/slide4.jpg",
        "/assets/slideshow/slide5.jpg",
      ]),

      loadingStatus: {
        inProgress: true,
        success: false,
        errorText: ''
      },

      nSlideShowTimer: null
    }
  },
  mounted() {

    const self = this;

    function StartSlideShow() {
      self.nSlideShowTimer = setInterval(() => {
        document.querySelector('.v-window__right').click();
      }, 5000)
    }

    function StopSlideShow() {
      if(self.nSlideShowTimer) {
        clearInterval(self.nSlideShowTimer)
        self.nSlideShowTimer = null;
      }
    }

    function PreloadImages() {
      for(const s_image of self.topImageArray) {
        const oImg = new Image();
        oImg.src = s_image;
        console.log('Preloading ', s_image)
      }
    }

    const s_api = process.env.VUE_APP_API_ENDPOINT + '/api/v1/slide-text'
    axios
        .get(s_api, {
          params: {
            s_slug: this.slug,
          }
        })
        .then((response) => {

          const o_response = response.data;

          this.loadingStatus.inProgress = false;
          this.loadingStatus.success = o_response.b_success;

          this.topTextArray = response.data.a_data;

          PreloadImages();

          StartSlideShow();

          document.querySelector('.v-window__right').addEventListener('click', (ev) => {
            // If mouse click (not simulated)
            if(ev.isTrusted) {
              StopSlideShow();
              StartSlideShow();
            }
          })

        })
        .catch((error) => {
          this.loadingStatus.errorText = error.message;
          this.loadingStatus.inProgress = false;
          this.loadingStatus.success = false;

          console.error('Chyba při získávání dat', s_api, error.message)
        })
  }
};
</script>
